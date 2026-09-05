import {useCallback, useMemo, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {usePeriod} from '@context/PeriodContext';
import {
  deleteCategory,
  getCategoriesByType,
  getCategoryUsage,
  getFinances,
  getSpendingByCategory,
  getIncomeByCategory,
  getLastMovementDates,
  IFinanceRow,
  IFinancesCursor,
} from '@db/queries';
import {
  financeTypeToCategoryType,
  sortCategoriesByRelevance,
} from '@screens/[categories]/CategoriesScreen/mappers';

export type LoadStatus = 'loading' | 'success' | 'error';

/**
 * All state/data-fetching for `CategoriesScreen`: the active tab's real
 * categories (`getCategoriesByType`) with each one's current-period
 * total, which category is selected, and that category's paginated
 * movement history (`getFinances({idCategory})`, keyset pagination —
 * same shape/strategy as `useAccountsScreen`'s account-scoped history,
 * mirrored here for the category-scoped equivalent).
 *
 * `financeType` is read once from the caller (`route.params.financeType`)
 * and never changes for the lifetime of a given screen instance — each
 * Material top tab (`Expenses`/`Incomes`) mounts its OWN
 * `CategoriesScreen`/`useCategoriesScreen` instance with its own fixed
 * `initialParams`, not a single instance whose params swap on tab
 * switch — so there is no "financeType changed under us" case to
 * handle here, unlike `selectedCategoryId` (which very much does change
 * within one instance's lifetime).
 *
 * Both sections reload on focus-regain (`useFocusEffect`), not a
 * mount-only effect — creating a movement from the `Form` tab or a new
 * category from `CreateCategory` are both one tab away, and this
 * screen should reflect either the moment the user comes back, same
 * reasoning as `useAccountsScreen`'s own doc comment.
 */
export const useCategoriesScreen = (financeType: FinanceType) => {
  const {t} = useTranslation();
  const categoryType = useMemo(() => financeTypeToCategoryType(financeType), [financeType]);
  /**
   * El periodo lo manda el contexto global, no el reloj de esta
   * pantalla. `anchorMonth` para los totales por categoria —que se
   * calculan por mes— y el tramo resuelto para la lista de movimientos.
   */
  const {resolved} = usePeriod();
  /**
   * La lista de movimientos se acota AL MISMO TRAMO que los totales de
   * las tarjetas.
   *
   * Antes no lo estaba: el total salia de
   * `getSpendingByCategory({period})` (solo el mes en curso) y la lista
   * de `getFinances({idCategory})` sin fecha (todo el historial). Con un
   * movimiento de agosto y el mes en septiembre, la pantalla mostraba
   * "Gastado este mes $0.00" con un gasto de $250.00 justo debajo, y se
   * leia como dinero perdido. Ver el historial completo es lo que hace
   * "Ver todos", que ya trae filtro por rango de tiempo.
   *
   * El mismo desajuste volvio a asomar cuando el selector de periodo
   * gano tramos de varios meses: los totales seguian pidiendo
   * `{period}`, que es `resolved.anchorMonth` —UN mes—, mientras la
   * lista de abajo ya traia el tramo entero. Con "Ultimos 3 meses" la
   * tarjeta decia el gasto de septiembre y debajo aparecian
   * movimientos de julio. Ahora ambos leen `resolved.from`/`to`, que es
   * el unico sitio donde el tramo esta definido.
   */
  const monthRange = useMemo(
    () => ({start: resolved.from, end: resolved.to}),
    [resolved.from, resolved.to],
  );

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<Map<number, number>>(new Map());
  /** Ultimo movimiento por categoria: desempata el orden de las tarjetas
   * cuando todo el mes esta a cero. */
  const [lastUsed, setLastUsed] = useState<Map<number, string>>(new Map());
  const [categoriesStatus, setCategoriesStatus] = useState<LoadStatus>('loading');
  const [categoriesErrorMessage, setCategoriesErrorMessage] = useState('');
  const hasLoadedCategoriesRef = useRef(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number>();

  const [financeItems, setFinanceItems] = useState<IFinanceRow[]>([]);
  const [financesStatus, setFinancesStatus] = useState<LoadStatus>('loading');
  const [financesErrorMessage, setFinancesErrorMessage] = useState('');
  const [nextCursor, setNextCursor] = useState<IFinancesCursor | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const hasLoadedFinancesRef = useRef(false);

  const loadCategories = useCallback(async () => {
    const silent = hasLoadedCategoriesRef.current;
    if (!silent) {
      setCategoriesStatus('loading');
    }
    setCategoriesErrorMessage('');
    try {
      const db = await getDbConnection();
      const categoriesResult = await getCategoriesByType(db, categoryType);

      let totals: Map<number, number>;
      if (categoryType === 'expense') {
        // One SQL round trip, already summed — see `getSpendingByCategory`.
        const spending = await getSpendingByCategory(db, {
          startDate: resolved.from,
          endDate: resolved.to,
        });
        totals = new Map(spending.map(row => [row.category.id, row.spent]));
      } else {
        // Simétrico al gasto: una sola consulta ya agregada en SQL.
        const income = await getIncomeByCategory(db, {
          startDate: resolved.from,
          endDate: resolved.to,
        });
        totals = new Map(income.map(row => [row.category.id, row.income]));
      }

      const {byCategory} = await getLastMovementDates(db);

      setCategories(categoriesResult);
      setCategoryTotals(totals);
      setLastUsed(byCategory);
      setSelectedCategoryId(prev => {
        // La seleccion por defecto sigue el MISMO orden que las
        // tarjetas, no el de la base. Con la fila cortada en ocho, la
        // primera por `id` puede no estar entre las visibles y la
        // pantalla abriria con una seleccion que no se ve por ninguna
        // parte.
        const [mostRelevant] = sortCategoriesByRelevance(
          categoriesResult,
          totals,
          byCategory,
        );
        const nextId =
          prev !== undefined && categoriesResult.some(category => category.id === prev)
            ? prev
            : mostRelevant?.id;
        // No category left to select (the active category was
        // removed, or this type has none at all) — without this, the
        // movements list below would keep showing a stale selection's
        // movements forever, since nothing else would ever trigger
        // `loadFinances` again.
        if (nextId === undefined) {
          setFinanceItems([]);
          setNextCursor(null);
        }
        return nextId;
      });
      setCategoriesStatus('success');
      hasLoadedCategoriesRef.current = true;
    } catch (e: any) {
      console.warn('[useCategoriesScreen] loadCategories failed:', e?.message ?? e);
      if (!silent) {
        setCategoriesErrorMessage(
          t('categories.loadCategoriesError', {message: e?.message ?? t('common.unknownError')}),
        );
        setCategoriesStatus('error');
      }
    }
  }, [categoryType, resolved.from, resolved.to, t]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories]),
  );

  const loadFinances = useCallback(async (categoryId: number) => {
    const silent = hasLoadedFinancesRef.current;
    if (!silent) {
      setFinancesStatus('loading');
    }
    setFinancesErrorMessage('');
    try {
      const db = await getDbConnection();
      const result = await getFinances(db, {
        idCategory: categoryId,
        from: monthRange.start,
        to: monthRange.end,
      });
      setFinanceItems(result.items);
      setNextCursor(result.nextCursor);
      setFinancesStatus('success');
      hasLoadedFinancesRef.current = true;
    } catch (e: any) {
      console.warn('[useCategoriesScreen] loadFinances failed:', e?.message ?? e);
      if (!silent) {
        setFinancesErrorMessage(
          t('categories.loadMovementsError', {message: e?.message ?? t('common.unknownError')}),
        );
        setFinancesStatus('error');
      }
    }
  }, [t, monthRange]);

  useFocusEffect(
    useCallback(() => {
      if (selectedCategoryId !== undefined) {
        loadFinances(selectedCategoryId);
      }
    }, [selectedCategoryId, loadFinances]),
  );

  // Selecting a DIFFERENT category resets pagination — a page-2 cursor
  // from the previously selected category is meaningless for this one.
  const selectCategory = useCallback((categoryId: number) => {
    setNextCursor(null);
    setSelectedCategoryId(categoryId);
  }, []);

  const loadMoreFinances = useCallback(async () => {
    if (!nextCursor || isLoadingMore || selectedCategoryId === undefined) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const db = await getDbConnection();
      const result = await getFinances(db, {
        idCategory: selectedCategoryId,
        cursor: nextCursor,
        // El mismo rango que la primera pagina: sin esto, al paginar
        // reaparecerian los movimientos de meses anteriores.
        from: monthRange.start,
        to: monthRange.end,
      });
      setFinanceItems(prev => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (e: any) {
      // Pagination failures stay silent on purpose: page 1 is still a
      // perfectly good, valid list — same call `useAccountsScreen`
      // makes for the identical case.
      console.warn('[useCategoriesScreen] loadMoreFinances failed:', e?.message ?? e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, selectedCategoryId, monthRange]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadCategories();
      if (selectedCategoryId !== undefined) {
        await loadFinances(selectedCategoryId);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCategories, loadFinances, selectedCategoryId]);

  const totalForPeriod = useMemo(() => {
    let total = 0;
    categoryTotals.forEach(value => {
      total += value;
    });
    return total;
  }, [categoryTotals]);

  /**
   * Cuantos movimientos y limites cuelgan de una categoria. La pantalla
   * lo pide ANTES de abrir la confirmacion de borrado, para avisar con
   * numeros reales en vez de con un "puede que afecte a algo".
   */
  const fetchCategoryUsage = useCallback(
    async (id: number): Promise<{movements: number; budgets: number}> => {
      try {
        const db = await getDbConnection();
        return await getCategoryUsage(db, id);
      } catch (e: any) {
        console.warn('[useCategoriesScreen] fetchCategoryUsage failed:', e?.message ?? e);
        // Ante la duda, cero: el dialogo mostrara el mensaje neutro en
        // vez de inventar cifras.
        return {movements: 0, budgets: 0};
      }
    },
    [],
  );

  /** Borra una categoria y recarga el listado. Ver `deleteCategory` para
   * que le pasa a sus movimientos (se quedan sin categoria, no se
   * borran). */
  const deleteCategoryById = useCallback(
    async (id: number): Promise<boolean> => {
      setIsDeletingCategory(true);
      try {
        const db = await getDbConnection();
        await deleteCategory(db, id);
        await loadCategories();
        return true;
      } catch (e: any) {
        console.warn('[useCategoriesScreen] deleteCategoryById failed:', e?.message ?? e);
        return false;
      } finally {
        setIsDeletingCategory(false);
      }
    },
    [loadCategories],
  );

  return {
    categories,
    categoryTotals,
    lastUsed,
    categoriesStatus,
    categoriesErrorMessage,
    reloadCategories: loadCategories,
    totalForPeriod,

    selectedCategoryId,
    selectCategory,

    financeItems,
    financesStatus,
    financesErrorMessage,
    reloadFinances: () =>
      selectedCategoryId !== undefined && loadFinances(selectedCategoryId),

    isLoadingMore,
    loadMoreFinances,

    isRefreshing,
    refresh,

    fetchCategoryUsage,
    deleteCategoryById,
    isDeletingCategory,
  };
};
