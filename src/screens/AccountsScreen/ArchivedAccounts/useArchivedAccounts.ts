import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {getAccounts, IAccountWithBalance, unarchiveAccount} from '@db/queries';

export type LoadStatus = 'loading' | 'success' | 'error';

/** Narrows `IAccountWithBalance.archivedAt` from `string | null` to
 * `string` — used to filter `getAccounts({includeArchived: true})`
 * down to archived-only rows with a type the render code can rely on. */
export type IArchivedAccount = IAccountWithBalance & {archivedAt: string};

const isArchived = (account: IAccountWithBalance): account is IArchivedAccount =>
  account.archivedAt !== null;

/**
 * Data-fetching for `ArchivedAccounts`. `@db/queries` has no
 * "archived-only" query — `getAccounts({includeArchived: true})`
 * returns BOTH active and archived rows — so this filters client-side
 * rather than requesting a new query shape from `@db/queries` (out of
 * scope for this slice; another agent owns that layer right now).
 * Sorted newest-archived-first, since that's the order a user checking
 * "what did I just archive" cares about most.
 *
 * Reloads on focus, same reasoning as `useAccountsScreen`: the user can
 * archive another account from `AccountsScreen`, come back here, and
 * expects this list to reflect it without a manual pull-to-refresh.
 *
 * `restoreAccountById` (now that `unarchiveAccount` exists in
 * `@db/queries`) reverses `archiveAccount` and reloads THIS list so the
 * restored account disappears from it immediately. `AccountsScreen`'s
 * own `useAccountsScreen` independently re-queries `getAccounts` every
 * time it regains focus, so navigating back there after a restore shows
 * the account (and the updated net worth) without any extra plumbing
 * between the two screens — both are just re-reading the same source of
 * truth.
 */
export const useArchivedAccounts = () => {
  const {t} = useTranslation();
  const [accounts, setAccounts] = useState<IArchivedAccount[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    const silent = hasLoadedRef.current;
    if (!silent) {
      setStatus('loading');
    }
    setErrorMessage('');
    try {
      const db = await getDbConnection();
      const all = await getAccounts(db, {includeArchived: true});
      const archived = all
        .filter(isArchived)
        .sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1));
      setAccounts(archived);
      setStatus('success');
      hasLoadedRef.current = true;
    } catch (e: any) {
      console.warn('[useArchivedAccounts] load failed:', e?.message ?? e);
      if (!silent) {
        setErrorMessage(
          t('accounts.loadArchivedError', {message: e?.message ?? t('common.unknownError')}),
        );
        setStatus('error');
      }
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const [isRestoring, setIsRestoring] = useState(false);

  /**
   * Restores one archived account, then reloads this list so it drops
   * out immediately. Returns `false` on failure so the caller can show
   * its own alert — same contract as `useAccountsScreen`'s
   * `archiveAccountById`.
   */
  const restoreAccountById = useCallback(
    async (accountId: number): Promise<boolean> => {
      setIsRestoring(true);
      try {
        const db = await getDbConnection();
        await unarchiveAccount(db, accountId);
        await load();
        return true;
      } catch (e: any) {
        console.warn(
          '[useArchivedAccounts] restoreAccountById failed:',
          e?.message ?? e,
        );
        return false;
      } finally {
        setIsRestoring(false);
      }
    },
    [load],
  );

  return {
    accounts,
    status,
    errorMessage,
    reload: load,
    restoreAccountById,
    isRestoring,
  };
};
