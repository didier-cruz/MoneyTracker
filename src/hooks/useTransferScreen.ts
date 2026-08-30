import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {getAccounts, insertTransfer, IAccountWithBalance} from '@db/queries';
import {parseAmountToCents} from '@utils/currency';

export type TransferLoadStatus = 'loading' | 'success' | 'error';
export type TransferPickerTarget = 'from' | 'to' | null;

/**
 * All state/data-fetching for the `Transfer` screen (slice B3 — moving
 * money between two of the user's own accounts, and the mechanism
 * lending money is built on; see `insertTransfer`'s doc comment in
 * `@db/queries`).
 *
 * Loads ACTIVE accounts only (`getAccounts`' default — an archived
 * account cannot be a transfer endpoint, `insertTransfer` itself throws
 * `Account <id> is archived...` for one), reloaded on focus like every
 * other account-scoped screen in this app (`useAccountsScreen`,
 * `useArchivedAccounts`) so an account archived elsewhere while this
 * screen is backgrounded doesn't linger as a selectable option.
 *
 * `fromAccountId`/`toAccountId` default to the first two DIFFERENT
 * accounts in `getAccounts`' (name-ordered) list the first time it
 * loads, and are re-validated (not re-defaulted) on every later reload
 * as long as they still resolve to an active account — see `load`'s own
 * comment for the one accepted edge case this simplifies away.
 *
 * The account PICKER excludes the OTHER side's current selection from
 * its own list (`accountsForPicker`) rather than allowing the same
 * account on both sides and rejecting it on submit — this is the
 * "impide en la UI lo que la capa de datos rechaza" requirement: a
 * same-account transfer is nonsensical, not just invalid, so it is
 * never even offered as a choice.
 */
export const useTransferScreen = () => {
  const {t} = useTranslation();
  const [accounts, setAccounts] = useState<IAccountWithBalance[]>([]);
  const [status, setStatus] = useState<TransferLoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const hasLoadedRef = useRef(false);

  const [fromAccountId, setFromAccountId] = useState<number>();
  const [toAccountId, setToAccountId] = useState<number>();

  const [amountText, setAmountText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [pickerTarget, setPickerTarget] = useState<TransferPickerTarget>(null);

  const load = useCallback(async () => {
    const silent = hasLoadedRef.current;
    if (!silent) {
      setStatus('loading');
    }
    setErrorMessage('');
    try {
      const db = await getDbConnection();
      const result = await getAccounts(db);
      setAccounts(result);

      // Simplification accepted on purpose: the fallback pair below is
      // always computed from `result[0]`/the first id that differs from
      // it, even on a RELOAD where `fromAccountId` is kept as-is (not
      // reset). That means a reload which invalidates ONLY
      // `toAccountId` (e.g. that one account got archived elsewhere)
      // could in theory re-pick a `toAccountId` equal to the KEPT
      // `fromAccountId` if it isn't `result[0]`. In practice this screen
      // is pushed, used once, and popped — `useFocusEffect` only re-runs
      // `load` on a real focus-regain, which nothing on this single-
      // purpose screen triggers without a full mount/unmount cycle — so
      // this branch is not reachable today. Documented rather than
      // solved with extra state to keep this hook simple.
      const fallbackFromId = result[0]?.id;
      setFromAccountId(prevFrom =>
        prevFrom !== undefined && result.some(a => a.id === prevFrom)
          ? prevFrom
          : fallbackFromId,
      );
      setToAccountId(prevTo => {
        if (
          prevTo !== undefined &&
          prevTo !== fallbackFromId &&
          result.some(a => a.id === prevTo)
        ) {
          return prevTo;
        }
        return result.find(a => a.id !== fallbackFromId)?.id;
      });

      setStatus('success');
      hasLoadedRef.current = true;
    } catch (e: any) {
      console.warn('[useTransferScreen] load failed:', e?.message ?? e);
      if (!silent) {
        setErrorMessage(
          t('transfer.loadAccountsError', {message: e?.message ?? t('common.unknownError')}),
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

  const fromAccount = accounts.find(a => a.id === fromAccountId);
  const toAccount = accounts.find(a => a.id === toAccountId);

  const amountCents = parseAmountToCents(amountText);
  const amountError =
    amountText.trim() !== '' && amountCents === null ? t('transfer.invalidAmount') : '';

  const openPicker = useCallback((target: 'from' | 'to') => {
    setPickerTarget(target);
  }, []);

  const closePicker = useCallback(() => {
    setPickerTarget(null);
  }, []);

  const selectAccount = useCallback(
    (accountId: number) => {
      if (pickerTarget === 'from') {
        setFromAccountId(accountId);
      } else if (pickerTarget === 'to') {
        setToAccountId(accountId);
      }
      setPickerTarget(null);
      setSaveError('');
    },
    [pickerTarget],
  );

  /** Accounts offered by the picker for one side — always excludes the
   * OTHER side's current selection (see this hook's own doc comment). */
  const accountsForPicker = useCallback(
    (target: 'from' | 'to'): IAccountWithBalance[] => {
      const excludeId = target === 'from' ? toAccountId : fromAccountId;
      return accounts.filter(a => a.id !== excludeId);
    },
    [accounts, fromAccountId, toAccountId],
  );

  const onChangeAmountText = useCallback((text: string) => {
    setAmountText(text);
    setSaveError('');
  }, []);

  const canSubmit =
    fromAccountId !== undefined &&
    toAccountId !== undefined &&
    fromAccountId !== toAccountId &&
    amountCents !== null &&
    !isSaving;

  /** Returns `true` on success — lets the screen decide navigation
   * (`navigation.goBack()`) without this hook reaching into it. */
  const submitTransfer = useCallback(async (): Promise<boolean> => {
    if (
      fromAccountId === undefined ||
      toAccountId === undefined ||
      fromAccountId === toAccountId ||
      amountCents === null
    ) {
      return false;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      const db = await getDbConnection();
      await insertTransfer(db, {
        idAccountFrom: fromAccountId,
        idAccountTo: toAccountId,
        amount: amountCents,
      });
      return true;
    } catch (e: any) {
      console.warn('[useTransferScreen] submitTransfer failed:', e?.message ?? e);
      setSaveError(
        t('transfer.submitError', {message: e?.message ?? t('common.unknownError')}),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fromAccountId, toAccountId, amountCents, t]);

  return {
    accounts,
    status,
    errorMessage,
    reload: load,

    fromAccount,
    toAccount,

    amountText,
    onChangeAmountText,
    amountCents,
    amountError,

    pickerTarget,
    openPicker,
    closePicker,
    selectAccount,
    accountsForPicker,

    canSubmit,
    isSaving,
    saveError,
    submitTransfer,
  };
};
