import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {getDbConnection} from '@db/db';
import {
  getAccounts,
  getCategories,
  getFinances,
  IAccountWithBalance,
  IFinanceRow,
  IFinancesCursor,
} from '@db/queries';
import {groupFinancesByMonth, MonthSection, TimeRange, timeRangeToWindow} from './mappers';

export type LoadStatus = 'loading' | 'success' | 'error';

/** `'all'` = sin filtrar por esa dimension. */
export type Filters = {
  range: TimeRange;
  accountId: number | 'all';
  categoryId: number | 'all';
};

/**
 * Todos los movimientos, filtrables por periodo, cuenta y categoria a la
 * vez, agrupados por mes y paginados.
 *
 * Los tres filtros se combinan con AND en UNA sola consulta
 * (`getFinances` ya los soporta juntos) en vez de filtrar en memoria:
 * esta lista puede crecer sin limite y traer todo a JS para descartar la
 * mayor parte seria pagar la lectura entera en cada cambio de filtro.
 *
 * Cambiar cualquier filtro REINICIA la paginacion: el cursor de keyset
 * apunta a una posicion dentro de un conjunto concreto, y reutilizarlo
 * con otro filtro devolveria una pagina de otra lista.
 */
export const useAllMovements = (initial: Partial<Filters> = {}) => {
  const {t} = useTranslation();

  const [filters, setFilters] = useState<Filters>({
    range: initial.range ?? 'all',
    accountId: initial.accountId ?? 'all',
    categoryId: initial.categoryId ?? 'all',
  });

  const [rows, setRows] = useState<IFinanceRow[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [cursor, setCursor] = useState<IFinancesCursor | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [accounts, setAccounts] = useState<IAccountWithBalance[]>([]);
  const [categories, setCategories] = useState<ICategory[]>([]);

  const queryOptions = useCallback(() => {
    const window = timeRangeToWindow(filters.range);
    return {
      ...window,
      ...(filters.accountId !== 'all' ? {idAccount: filters.accountId} : {}),
      ...(filters.categoryId !== 'all' ? {idCategory: filters.categoryId} : {}),
    };
  }, [filters]);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const db = await getDbConnection();
      const result = await getFinances(db, queryOptions());
      setRows(result.items);
      setCursor(result.nextCursor);
      setStatus('success');
    } catch (e: any) {
      setErrorMessage(
        t('allMovements.loadError', {message: e?.message ?? t('common.unknownError')}),
      );
      setStatus('error');
    }
  }, [queryOptions, t]);

  useEffect(() => {
    load();
  }, [load]);

  /** Las opciones de los chips: se leen una vez, no dependen del filtro. */
  const loadFilterSources = useCallback(async () => {
    try {
      const db = await getDbConnection();
      const [accountRows, categoryRows] = await Promise.all([
        getAccounts(db),
        getCategories(db),
      ]);
      setAccounts(accountRows);
      setCategories(categoryRows);
    } catch (e: any) {
      // Un fallo aqui deja los chips sin opciones, pero la lista sigue
      // siendo util: no se convierte en un error de pantalla completa.
      console.warn('[useAllMovements] loadFilterSources failed:', e?.message ?? e);
    }
  }, []);

  useEffect(() => {
    loadFilterSources();
  }, [loadFilterSources]);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoadingMore || status !== 'success') {
      return;
    }
    setIsLoadingMore(true);
    try {
      const db = await getDbConnection();
      const result = await getFinances(db, {...queryOptions(), cursor});
      setRows(prev => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } catch (e: any) {
      // Silencioso a proposito, igual que el resto de paginaciones de la
      // app: la lista deja de crecer, pero lo ya cargado sigue ahi.
      console.warn('[useAllMovements] loadMore failed:', e?.message ?? e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, status, queryOptions]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters(prev => ({...prev, [key]: value}));

  const sections: MonthSection[] = groupFinancesByMonth(rows);
  const hasFiltersApplied =
    filters.range !== 'all' ||
    filters.accountId !== 'all' ||
    filters.categoryId !== 'all';

  return {
    filters,
    setFilter,
    clearFilters: () => setFilters({range: 'all', accountId: 'all', categoryId: 'all'}),
    hasFiltersApplied,

    accounts,
    categories,

    sections,
    count: rows.length,
    status,
    errorMessage,
    reload: load,
    loadMore,
    isLoadingMore,
    isRefreshing,
    refresh,
  };
};
