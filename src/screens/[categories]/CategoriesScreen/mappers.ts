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
 * Sentinel id for the dashed "New" tile appended to the grid by
 * `mapCategoriesToTiles` — NOT a real category id (`categories.id` is
 * an `AUTOINCREMENT` primary key, always >= 1), so it can never
 * collide with one. `CategoriesScreen`'s grid press handler checks for
 * this id to navigate to `CreateCategory` instead of selecting it.
 */
export const ADD_CATEGORY_TILE_ID = -1;

export interface ICategoryTile {
  id: number;
  icon: string;
  name: string;
  /** Cents, `>= 0` — this category's total for the current period (see
   * `getCurrentPeriod`). `0` for a category with no qualifying activity
   * yet, never `undefined`. Meaningless for the trailing "New" tile. */
  amount: number;
  isAdd?: boolean;
}

/**
 * Maps `getCategoriesByType`'s rows + this period's per-category totals
 * (see `useCategoriesScreen`) into the grid's tile shape, plus one
 * trailing synthetic "New" tile (see `ADD_CATEGORY_TILE_ID`) — same
 * "real rows + one synthetic affordance at the end" idiom
 * `AccountsScreen/mappers.ts`'s `mapAccountsToCatalogCards` uses for
 * "Add account". Not from an approved prototype for the EMPTY case
 * specifically: even when `categories` is empty, this still returns a
 * one-tile array (just the "New" tile) so the grid — and the only way
 * to create a category from this screen — never disappears.
 */
export const mapCategoriesToTiles = (
  categories: ICategory[],
  totals: Map<number, number>,
): ICategoryTile[] => {
  const categoryTiles: ICategoryTile[] = categories.map(category => ({
    id: category.id,
    icon: category.icon,
    name: category.name,
    amount: totals.get(category.id) ?? 0,
  }));

  const addTile: ICategoryTile = {
    id: ADD_CATEGORY_TILE_ID,
    icon: 'plus',
    name: i18n.t('categories.newTile'),
    amount: 0,
    isAdd: true,
  };

  return [...categoryTiles, addTile];
};

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
