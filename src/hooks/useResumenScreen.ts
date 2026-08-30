import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {getCashFlowByMonth, getFinances, getNetWorth, ICashFlowMonth, IFinanceRow} from '@db/queries';
import {getCashFlowWindowStartMonth} from '@screens/ResumenScreen/mappers';

export type LoadStatus = 'loading' | 'success' | 'error';

/** How many of the most recent movements the dashboard's "Movements"
 * preview card shows — a snapshot, not the paginated full history
 * `AccountsScreen`'s own per-account list already covers; "See all"
 * hands off to that existing list rather than this screen growing its
 * own pagination (see `ResumenScreen`'s HANDOFF note). */
const RECENT_FINANCES_LIMIT = 5;

/**
 * All data-fetching for `ResumenScreen` (the Dashboard): net worth (the
 * indigo card's "Available" figure), the last six calendar months of
 * income/expense/savings (the cash-flow chart), and the most recent
 * movements (the "Movements" preview card) — three independent reads,
 * fetched together with a single `Promise.all` and tracked as ONE
 * combined load status, unlike `useAccountsScreen`'s two-status split.
 * That split exists there because its two sections are independently
 * re-triggerable (switching the selected account only reloads
 * finances); here all three numbers describe the exact same "right now"
 * snapshot and are always requested together, so one status is the
 * simpler, equally correct model.
 *
 * Reloads on every focus regain (`useFocusEffect`), not just on mount —
 * a movement can be logged from the "Outcomes" tab (`FormScreen`) and
 * the user lands back here expecting the balance/chart/list to already
 * reflect it. The very first load shows the full loading state; every
 * later reload (focus regain, pull-to-refresh) is "silent" (no spinner
 * flash) — same reasoning as every other screen hook in this codebase:
 * a local SQLite read is fast, and pull-to-refresh's own `RefreshControl`
 * spinner (`isRefreshing`) already gives explicit feedback when asked
 * for.
 */
export const useResumenScreen = () => {
  const {t} = useTranslation();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [netWorth, setNetWorth] = useState(0);
  const [cashFlowMonths, setCashFlowMonths] = useState<ICashFlowMonth[]>([]);
  const [recentFinances, setRecentFinances] = useState<IFinanceRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    const silent = hasLoadedRef.current;
    if (!silent) {
      setStatus('loading');
    }
    setErrorMessage('');
    try {
      const db = await getDbConnection();
      const [netWorthResult, cashFlowResult, financesResult] = await Promise.all([
        getNetWorth(db),
        getCashFlowByMonth(db, {startMonth: getCashFlowWindowStartMonth()}),
        getFinances(db, {limit: RECENT_FINANCES_LIMIT}),
      ]);
      setNetWorth(netWorthResult);
      setCashFlowMonths(cashFlowResult);
      setRecentFinances(financesResult.items);
      setStatus('success');
      hasLoadedRef.current = true;
    } catch (e: any) {
      console.warn('[useResumenScreen] load failed:', e?.message ?? e);
      if (!silent) {
        setErrorMessage(t('resumen.loadError', {message: e?.message ?? t('common.unknownError')}));
        setStatus('error');
      }
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  return {
    status,
    errorMessage,
    reload: load,
    netWorth,
    cashFlowMonths,
    recentFinances,
    isRefreshing,
    refresh,
  };
};
