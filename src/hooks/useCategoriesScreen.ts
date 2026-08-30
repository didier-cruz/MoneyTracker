import {useCallback, useMemo, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {
  getCategoriesByType,
  getFinances,
  getSpendingByCategory,
  getIncomeByCategory,
  IFinanceRow,
  IFinancesCursor,
} from '@db/queries';
import {financeTypeToCategoryType, getCurrentPeriod} from '@screens/[categories]/CategoriesScreen/mappers';

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
  const period = useMemo(() => getCurrentPeriod(), []);

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<Map<number, number>>(new Map());
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
        const spending = await getSpendingByCategory(db, {period});
        totals = new Map(spending.map(row => [row.category.id, row.spent]));
      } else {
        // Simétrico al gasto: una sola consulta ya agregada en SQL.
        const income = await getIncomeByCategory(db, {period});
        totals = new Map(income.map(row => [row.category.id, row.income]));
      }

      setCategories(categoriesResult);
      setCategoryTotals(totals);
      setSelectedCategoryId(prev => {
        const nextId =
          prev !== undefined && categoriesResult.some(category => category.id === prev)
            ? prev
            : categoriesResult[0]?.id;
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
  }, [categoryType, period, t]);

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
      const result = await getFinances(db, {idCategory: categoryId});
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
  }, [t]);

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
  }, [nextCursor, isLoadingMore, selectedCategoryId]);

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

  return {
    categories,
    categoryTotals,
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
  };
};
