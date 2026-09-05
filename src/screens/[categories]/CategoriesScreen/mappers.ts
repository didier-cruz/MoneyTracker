import {IFinanceRow} from '@db/queries';
import {colors} from '@constants/colors/colors';
import {formatDisplayDate, formatDisplayTime, toLocalDateKey} from '@utils/dateFormat';
import i18n from '@i18n';

/**
 * The tab route param (`route.params.financeType`, `CategoriesTopTabsNavigatorParams`)
 * is the app-wide plural `FinanceType` (`'expenses'|'incomes'`, see
 * `src/interfaces/common.d.ts`), while `@db/queries`' category contract
 * (`getCategoriesByType`, `ICategory['type']`) is the singular
 * `'expense'|'income'`. This is the ONE place that bridges the two —
 * every call into `@db/queries` from this screen goes through
 * `financeTypeToCategoryType` first, rather than each call site
 * re-deriving (and risking drifting on) the same singular/plural mapping.
 */
const FINANCE_TYPE_TO_CATEGORY_TYPE: Record<FinanceType, ICategory['type']> = {
  expenses: 'expense',
  incomes: 'income',
};

export const financeTypeToCategoryType = (financeType: FinanceType): ICategory['type'] =>
  FINANCE_TYPE_TO_CATEGORY_TYPE[financeType];

/**
 * `'YYYY-MM'` for "this calendar month", in UTC — matching
 * `periodToRange`'s own UTC month-boundary math (`Date.UTC(...)`,
 * `@db/queries/period.ts`) rather than the device's local calendar
 * month, so the two never disagree near a UTC/local month-boundary edge.
 */
export const getCurrentPeriod = (): string => new Date().toISOString().slice(0, 7);


/**
 * Groups the selected category's `getFinances({idCategory})` rows into
 * `TransactItem`'s day-sectioned shape (same shape/day-grouping strategy
 * as `AccountsScreen/mappers.ts`'s `groupFinancesByDate`, re-derived
 * here rather than imported — that file is scoped to `AccountsScreen`,
 * a screen this slice does not touch).
 *
 * Unlike the accounts version, there is no transfer-leg case to handle:
 * `getFinances({idCategory: ...})` can only ever return rows whose
 * `idCategory` matches, and a transfer leg's `idCategory` is always
 * `NULL` (see `IFinanceRow.category`'s doc comment in
 * `financesQueries.ts`) — so every row here is guaranteed categorized,
 * `row.category` is never `null` in practice for this screen's query.
 *
 * Each row's label is its ACCOUNT's name/icon, not its category's — the
 * category is already the thing the user just selected (shown once in
 * the grid/header above), so repeating it per row would be redundant;
 * showing which account the movement posted against is the new,
 * useful piece of information for this list instead.
 */
export const groupCategoryFinancesByDate = (rows: IFinanceRow[]): SectionTransactItem[] => {
  const sections: SectionTransactItem[] = [];
  const sectionIndexByDateKey = new Map<string, number>();

  for (const row of rows) {
    const dateKey = toLocalDateKey(row.dateCreated);
    const transactItem: TransactItem = {
      id: row.id,
      icon: row.account.icon,
      category: row.account.name,
      amount: row.amount,
      date: formatDisplayTime(row.dateCreated),
      color: row.amount > 0 ? colors.success[0] : colors.error[0],
    };

    const existingSectionIndex = sectionIndexByDateKey.get(dateKey);
    if (existingSectionIndex !== undefined) {
      sections[existingSectionIndex].data.push(transactItem);
    } else {
      sectionIndexByDateKey.set(dateKey, sections.length);
      sections.push({
        date: formatDisplayDate(row.dateCreated),
        data: [transactItem],
      });
    }
  }

  return sections;
};

/**
 * Id sintetico de la tarjeta "crear categoria". Negativo para que no
 * pueda chocar con un id real de la base — mismo truco que
 * `ADD_ACCOUNT_CARD_ID` en cuentas.
 */
export const ADD_CATEGORY_CARD_ID = -1;
/** Tarjeta que abre la hoja con el listado completo. */
export const SEE_ALL_CATEGORIES_CARD_ID = -2;
/**
 * "Ninguna seleccionada". Un id imposible y con nombre: antes se pasaba
 * un `-2` suelto como centinela, que es justo el id que ahora ocupa la
 * tarjeta de "ver todas" — habria quedado marcada como seleccionada.
 */
export const NO_CATEGORY_SELECTED_ID = -99;
/**
 * Cuantas categorias reales se muestran en la fila horizontal.
 *
 * Con 19 categorias sembradas la fila eran 8.8 pantallas de
 * desplazamiento (medido: tarjeta 153dp + hueco 20dp, caben 2.27 por
 * pantalla). Ocho son 3.5 pantallas, que sigue siendo un gesto comodo, y
 * el resto se alcanza por la hoja de "ver todas". Menos de ocho obliga a
 * abrir la hoja casi siempre; mas de diez no arregla nada.
 */
export const VISIBLE_CATEGORY_CARDS = 8;

/**
 * Adapta las categorias a la forma `CatalogCard` de la lista horizontal
 * de cuentas, mas una tarjeta final para crear una nueva.
 *
 * Reutiliza `CatalogList`/`CatalogCard` en vez de mantener una rejilla
 * propia: las dos mitades de Movimientos hacen exactamente lo mismo
 * —elegir un elemento para ver sus movimientos— y con la rejilla de tres
 * columnas los movimientos quedaban por debajo del pliegue, solo
 * alcanzables haciendo scroll. Con una fila horizontal la lista de
 * movimientos entra en pantalla al abrir, que era el objetivo del
 * rediseno.
 *
 * `balance` lleva el total del PERIODO de cada categoria, no un saldo:
 * la tarjeta solo lo formatea como dinero, y para una categoria el
 * numero que importa es cuanto llevas gastado o ganado este mes.
 */
export const mapCategoryToCatalogCard = (
  category: ICategory,
  total: number,
): CatalogCard => ({
  id: category.id,
  icon: category.icon,
  iconColor: colors.white[0],
  iconBackground: colors.primary[0],
  field: category.name,
  balance: total,
  variant: 'square',
});

/**
 * Ordena las categorias por lo MOVIDO ESTE MES, de mayor a menor, y
 * desempata por la usada mas recientemente y luego por nombre.
 *
 * El orden importa tanto como el numero: cortar por los ocho PRIMEROS
 * seria cortar por `id`, es decir por orden de creacion, y te dejaria
 * fuera justo las que mas usas. Se compara por valor ABSOLUTO porque un
 * gasto se guarda en negativo y un ingreso en positivo: sin `Math.abs`
 * la lista de gastos saldria del reves, con lo menos gastado primero.
 */
export const sortCategoriesByRelevance = (
  categories: ICategory[],
  totals: Map<number, number>,
  lastUsed: Map<number, string>,
): ICategory[] =>
  [...categories].sort((a, b) => {
    const byTotal = Math.abs(totals.get(b.id) ?? 0) - Math.abs(totals.get(a.id) ?? 0);
    if (byTotal !== 0) {
      return byTotal;
    }
    const lastA = lastUsed.get(a.id) ?? '';
    const lastB = lastUsed.get(b.id) ?? '';
    if (lastA !== lastB) {
      return lastB.localeCompare(lastA);
    }
    return a.name.localeCompare(b.name);
  });

/**
 * Las tarjetas de la fila horizontal: las `VISIBLE_CATEGORY_CARDS` mas
 * relevantes, luego "ver todas" (solo si hay mas de las que caben) y al
 * final la de crear.
 */
/**
 * Deja la seleccionada SIEMPRE dentro de las visibles.
 *
 * Sin esto, elegir en la hoja una categoria que no esta entre las ocho
 * primeras la selecciona de verdad —los movimientos de abajo cambian—
 * pero la fila no marca ninguna tarjeta, asi que no hay forma de saber
 * que estas mirando. Verificado en el emulador antes de existir: elegir
 * "Suscripciones" dejaba la fila mostrando Farmacia e Internet sin nada
 * resaltado.
 *
 * Se pone la PRIMERA, no al final: asi se ve sin desplazar la fila.
 */
const pinSelectedFirst = <T extends {id: number}>(
  ordered: T[],
  limit: number,
  selectedId?: number,
): T[] => {
  const visible = ordered.slice(0, limit);
  if (selectedId === undefined || visible.some(item => item.id === selectedId)) {
    return visible;
  }
  const selected = ordered.find(item => item.id === selectedId);
  if (!selected) {
    return visible;
  }
  return [selected, ...visible.slice(0, limit - 1)];
};

export const mapCategoriesToCatalogCards = (
  categories: ICategory[],
  totals: Map<number, number>,
  lastUsed: Map<number, string> = new Map(),
  selectedId?: number,
): CatalogCard[] => {
  const ordered = sortCategoriesByRelevance(categories, totals, lastUsed);
  const visible = pinSelectedFirst(ordered, VISIBLE_CATEGORY_CARDS, selectedId);

  const cards: CatalogCard[] = visible.map(category =>
    mapCategoryToCatalogCard(category, totals.get(category.id) ?? 0),
  );

  // "Ver todas" se muestra SIEMPRE, no solo cuando algo queda fuera.
  //
  // Antes iba condicionada a `hidden > 0` y desaparecia justo en el caso
  // limite: con 8 cuentas y un corte de 8 no sobra ninguna, asi que no
  // habia forma de abrir el listado completo ni de buscar por nombre. Y
  // ademas la fila cambiaba de composicion sola al crear la novena, que
  // es lo contrario de una interfaz predecible.
  cards.push({
    id: SEE_ALL_CATEGORIES_CARD_ID,
      icon: 'ellipsis-h',
      iconColor: colors.primary[0],
      iconBackground: colors.inactive[0],
    field: i18n.t('categories.seeAllCards', {count: ordered.length}),
    balance: 0,
    variant: 'add',
  });

  cards.push({
    id: ADD_CATEGORY_CARD_ID,
    icon: 'plus',
    iconColor: colors.primary[0],
    iconBackground: colors.inactive[0],
    field: i18n.t('categories.addCategory'),
    balance: 0,
    variant: 'add',
  });

  return cards;
};
