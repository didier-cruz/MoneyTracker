import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {usePeriod} from '@context/PeriodContext';
import {sortAccountsByRelevance} from '@screens/AccountsScreen/mappers';
import {
  archiveAccount,
  getAccounts,
  getFinances,
  getNetWorth,
  IAccountWithBalance,
  IFinanceRow,
  IFinancesCursor,
  getLastMovementDates,
} from '@db/queries';

export type LoadStatus = 'loading' | 'success' | 'error';

/**
 * All state/data-fetching for `AccountsScreen`: the account list + net
 * worth strip, which account is selected, and that account's paginated
 * movement history. Split out of the screen component itself so the
 * screen stays a thin render function, matching `useFormScreen`/
 * `useCategoryForm`'s existing split.
 *
 * Accounts/net-worth and the selected account's finances are reloaded
 * every time this screen regains focus (`useFocusEffect`, not a plain
 * `useEffect`) — the user can create a transaction from the `Form`
 * screen (a different tab) or a new account from `CreateAccount` and
 * come back here; a mount-only effect would show stale balances until
 * a manual pull-to-refresh.
 *
 * The very first load of each section shows the full loading state;
 * every reload after that (focus-regain, account switch) is "silent"
 * (no full-screen spinner) since a local SQLite read is fast enough
 * that flashing a spinner on every tab switch would just be noise —
 * pull-to-refresh's own `RefreshControl` spinner (`isRefreshing`) still
 * gives explicit feedback when the user asks for one.
 */
export const useAccountsScreen = () => {
  const {t} = useTranslation();
  const [accounts, setAccounts] = useState<IAccountWithBalance[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<LoadStatus>('loading');
  const [accountsErrorMessage, setAccountsErrorMessage] = useState('');
  const [netWorth, setNetWorth] = useState<number>(0);
  const hasLoadedAccountsRef = useRef(false);

  /** Ultimo movimiento por cuenta: desempata el orden de las tarjetas
   * cuando dos cuentas tienen el mismo saldo. */
  const [lastUsed, setLastUsed] = useState<Map<number, string>>(new Map());
  /**
   * El tramo que mira la app. Acota la LISTA de movimientos de la cuenta
   * elegida, no los saldos: un saldo es `initialBalance + SUM(amount)`
   * sobre todo el historico y nunca se filtra por fecha —regla de este
   * proyecto, no una decision de esta pantalla—, asi que el patrimonio
   * neto sigue siendo acumulado aunque mires un mes concreto.
   */
  const {resolved} = usePeriod();

  const [selectedAccountId, setSelectedAccountId] = useState<number>();

  const [financeItems, setFinanceItems] = useState<IFinanceRow[]>([]);
  const [financesStatus, setFinancesStatus] = useState<LoadStatus>('loading');
  const [financesErrorMessage, setFinancesErrorMessage] = useState('');
  const [nextCursor, setNextCursor] = useState<IFinancesCursor | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedFinancesRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    const silent = hasLoadedAccountsRef.current;
    if (!silent) {
      setAccountsStatus('loading');
    }
    setAccountsErrorMessage('');
    try {
      const db = await getDbConnection();
      const [accountsResult, netWorthResult, lastMovements] = await Promise.all([
        getAccounts(db),
        getNetWorth(db),
        getLastMovementDates(db),
      ]);
      setAccounts(accountsResult);
      setNetWorth(netWorthResult);
      setLastUsed(lastMovements.byAccount);
      setSelectedAccountId(prev => {
        // La seleccion por defecto sigue el MISMO orden que las
        // tarjetas: con la fila cortada en ocho, la primera por `id`
        // puede no estar entre las visibles.
        const [mostRelevant] = sortAccountsByRelevance(
          accountsResult,
          lastMovements.byAccount,
        );
        const nextId =
          prev !== undefined && accountsResult.some(account => account.id === prev)
            ? prev
            : mostRelevant?.id;
        // The previously-selected account is gone (archived, most
        // likely) and there is nothing left to fall back to selecting
        // — without this, the transactions list below would keep
        // showing that gone account's stale movements forever, since
        // nothing else would ever trigger `loadFinances` again.
        if (nextId === undefined) {
          setFinanceItems([]);
          setNextCursor(null);
        }
        return nextId;
      });
      setAccountsStatus('success');
      hasLoadedAccountsRef.current = true;
    } catch (e: any) {
      console.warn('[useAccountsScreen] loadAccounts failed:', e?.message ?? e);
      if (!silent) {
        setAccountsErrorMessage(
          t('accounts.loadAccountsError', {message: e?.message ?? t('common.unknownError')}),
        );
        setAccountsStatus('error');
      }
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts]),
  );

  const loadFinances = useCallback(async (accountId: number) => {
    const silent = hasLoadedFinancesRef.current;
    if (!silent) {
      setFinancesStatus('loading');
    }
    setFinancesErrorMessage('');
    try {
      const db = await getDbConnection();
      const result = await getFinances(db, {
        idAccount: accountId,
        from: resolved.from,
        to: resolved.to,
      });
      setFinanceItems(result.items);
      setNextCursor(result.nextCursor);
      setFinancesStatus('success');
      hasLoadedFinancesRef.current = true;
    } catch (e: any) {
      console.warn('[useAccountsScreen] loadFinances failed:', e?.message ?? e);
      if (!silent) {
        setFinancesErrorMessage(
          t('accounts.loadTransactionsError', {message: e?.message ?? t('common.unknownError')}),
        );
        setFinancesStatus('error');
      }
    }
    // `resolved.from/to` en las dependencias: sin ellas el callback
    // cerraria sobre el periodo VIEJO y la lista no se refrescaria al
    // cambiarlo. Lo caza ESLint, no el compilador.
  }, [t, resolved.from, resolved.to]);

  useFocusEffect(
    useCallback(() => {
      if (selectedAccountId !== undefined) {
        loadFinances(selectedAccountId);
      }
    }, [selectedAccountId, loadFinances]),
  );

  // Selecting a DIFFERENT account resets pagination — a page-2 cursor
  // from the previously selected account is meaningless for this one.
  const selectAccount = useCallback((accountId: number) => {
    setNextCursor(null);
    setSelectedAccountId(accountId);
  }, []);

  const loadMoreFinances = useCallback(async () => {
    if (!nextCursor || isLoadingMore || selectedAccountId === undefined) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const db = await getDbConnection();
      const result = await getFinances(db, {
        idAccount: selectedAccountId,
        cursor: nextCursor,
        // El mismo tramo que la primera pagina: sin esto, al paginar
        // reapareceran movimientos de fuera del periodo.
        from: resolved.from,
        to: resolved.to,
      });
      setFinanceItems(prev => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (e: any) {
      // Pagination failures stay silent on purpose: page 1 is still a
      // perfectly good, valid list — surfacing a full error state here
      // would blank that out over a "couldn't fetch page 2" hiccup. The
      // user can just scroll again (or pull-to-refresh) to retry.
      console.warn('[useAccountsScreen] loadMoreFinances failed:', e?.message ?? e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, selectedAccountId, resolved.from, resolved.to]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadAccounts();
      if (selectedAccountId !== undefined) {
        await loadFinances(selectedAccountId);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAccounts, loadFinances, selectedAccountId]);

  const [isArchiving, setIsArchiving] = useState(false);

  /**
   * Archives (soft-deletes) one account, then reloads the account
   * list/net worth so the archived account disappears from the UI
   * immediately. `loadAccounts` already resolves what the new
   * `selectedAccountId` should be (and clears stale finances if none
   * are left) — nothing extra to do here beyond triggering that reload.
   * Returns `false` on failure so the caller can show its own alert.
   */
  const archiveAccountById = useCallback(
    async (accountId: number): Promise<boolean> => {
      setIsArchiving(true);
      try {
        const db = await getDbConnection();
        await archiveAccount(db, accountId);
        await loadAccounts();
        return true;
      } catch (e: any) {
        console.warn(
          '[useAccountsScreen] archiveAccountById failed:',
          e?.message ?? e,
        );
        return false;
      } finally {
        setIsArchiving(false);
      }
    },
    [loadAccounts],
  );

  return {
    accounts,
    lastUsed,
    accountsStatus,
    accountsErrorMessage,
    netWorth,
    reloadAccounts: loadAccounts,

    selectedAccountId,
    selectAccount,

    archiveAccountById,
    isArchiving,

    financeItems,
    financesStatus,
    financesErrorMessage,
    reloadFinances: () =>
      selectedAccountId !== undefined && loadFinances(selectedAccountId),

    isLoadingMore,
    loadMoreFinances,

    isRefreshing,
    refresh,
  };
};
