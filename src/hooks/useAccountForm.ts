import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {AccountKind, getAccountById, insertAccount, updateAccount} from '@db/queries';
import {formatCentsToCurrency, parseInitialBalanceToCents} from '@utils/currency';
import {icons} from '@data/icons';
import {useNoticeDialog} from '@hooks/useNoticeDialog';

const DEFAULT_ACCOUNT_KIND: AccountKind = 'cash';

export type AccountFormMode = 'create' | 'edit';
export type AccountFormLoadStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Strips `formatCentsToCurrency`'s display decoration ("$", thousands
 * commas) so its output can seed the same editable `decimal-pad` text
 * field that `parseInitialBalanceToCents` later re-parses on save —
 * reuses both existing money utilities instead of writing a new
 * cents<->string conversion.
 *
 * `Math.abs` is defensive, not expected to ever fire: this field's
 * keyboard has no `-` key (see `parseInitialBalanceToCents`), so every
 * `initialBalance` this form has ever produced is >= 0. Only a value
 * written outside this UI could be negative; showing its magnitude here
 * is a safer fallback than mis-parsing (or crashing on) a leading `-`
 * this field has never had to handle.
 */
const centsToEditableAmountText = (cents: number): string =>
  formatCentsToCurrency(Math.abs(cents)).replace(/[$,]/g, '');

/**
 * Form state for creating OR editing an account — same shape/spirit as
 * `useCategoryForm`, adapted to `accounts`' fields (`kind`,
 * `initialBalance`) instead of `categories`' (`type`).
 *
 * Pass an `accountId` to switch into edit mode: the hook loads that
 * account (`getAccountById`) and prefills every field before the form
 * is usable, and `saveAccount` calls `updateAccount` instead of
 * `insertAccount`. This is the SAME hook/form `CreateAccount` always
 * used — editing an account is not different enough from creating one
 * to justify a second hook (same fields, same validation, same
 * icon/kind pickers), only the load-then-prefill step and which write
 * query runs on save differ.
 */
export const useAccountForm = (accountId?: number) => {
  const {t} = useTranslation();
  const mode: AccountFormMode = accountId !== undefined ? 'edit' : 'create';

  // See this hook's file-level doc note in this slice's HANDOFF: a hook
  // can't render JSX, so a save success/failure notice (an
  // `Alert.alert` before) is exposed as `notice`/`dismissNotice` state
  // instead — `CreateAccount` (the only screen that calls this hook)
  // owns the actual `<ConfirmDialog>` element reading it.
  const {notice, showNotice, dismissNotice} = useNoticeDialog();

  const [inputText, setInputText] = useState<string>('');

  const [selectedIcon, onChangeSelectedIcon] = useState<IIcon>();

  const [selectedKind, setSelectedKind] =
    useState<AccountKind>(DEFAULT_ACCOUNT_KIND);

  const [initialBalanceText, setInitialBalanceText] = useState<string>('');

  const [error, setError] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Only meaningful in edit mode: prefilling the fields above requires
  // an async DB read before the form has anything real to show.
  // `CreateAccount` gates its full-form render on this being 'success'
  // (or the hook being in 'create' mode, where it just stays 'idle').
  const [loadStatus, setLoadStatus] = useState<AccountFormLoadStatus>(
    mode === 'edit' ? 'loading' : 'idle',
  );
  const [loadErrorMessage, setLoadErrorMessage] = useState('');

  const loadAccount = useCallback(async () => {
    if (accountId === undefined) {
      return;
    }
    setLoadStatus('loading');
    setLoadErrorMessage('');
    try {
      const db = await getDbConnection();
      const account = await getAccountById(db, accountId);
      if (!account) {
        setLoadErrorMessage(t('accounts.form.notFound'));
        setLoadStatus('error');
        return;
      }
      setInputText(account.name);
      // `icons` (the static picker list `SymbolList` renders) may not
      // contain this exact icon string in the unlikely case it was
      // written by something other than this same form — falling back
      // to a synthetic `{id: -1, icon}` still lets the field display
      // and save the account unchanged, just without a highlighted
      // match in the picker.
      const matchedIcon = icons.find(i => i.icon === account.icon);
      onChangeSelectedIcon(matchedIcon ?? {id: -1, icon: account.icon});
      setSelectedKind(account.kind);
      setInitialBalanceText(centsToEditableAmountText(account.initialBalance));
      setLoadStatus('success');
    } catch (e: any) {
      setLoadErrorMessage(
        t('accounts.form.loadError', {message: e?.message ?? t('common.unknownError')}),
      );
      setLoadStatus('error');
    }
  }, [accountId, t]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const onChangeInputText = (text: string) => {
    setInputText(text);
  };

  const onChangeSelectedKind = (kind: AccountKind) => {
    setSelectedKind(kind);
  };

  const onChangeInitialBalanceText = (text: string) => {
    setInitialBalanceText(text);
  };

  const handlePressItem = (id: number, icon: string) => {
    onChangeSelectedIcon({id, icon});
  };

  // Drives `SaveAction`'s `disabled` state: a name and an icon are both
  // required (kind always has a default, initial balance defaults to
  // $0.00 when left blank), and a save already in flight blocks
  // re-submitting.
  const canSave = inputText.trim() !== '' && !!selectedIcon && !isSaving;

  /** Returns `true` on success, `false` on a validation/save failure —
   * lets the screen decide what to do next (e.g. navigate back)
   * without this hook reaching into navigation itself. */
  const saveAccount = async (): Promise<boolean> => {
    if (inputText.trim() === '') {
      setError(t('accounts.form.nameRequired'));
      return false;
    }
    if (!selectedIcon) {
      setError(t('accounts.form.iconRequired'));
      return false;
    }
    const initialBalance = parseInitialBalanceToCents(initialBalanceText);
    if (initialBalance === null) {
      setError(t('accounts.form.invalidInitialBalance'));
      return false;
    }
    setIsSaving(true);
    try {
      const db = await getDbConnection();
      if (mode === 'edit' && accountId !== undefined) {
        await updateAccount(db, accountId, {
          name: inputText.trim(),
          icon: selectedIcon.icon,
          kind: selectedKind,
          initialBalance,
        });
        setError('');
        showNotice('info', t('common.success'), t('accounts.form.updated'));
        return true;
      }
      await insertAccount(db, {
        name: inputText.trim(),
        icon: selectedIcon.icon,
        kind: selectedKind,
        initialBalance,
      });
      setError('');
      setInputText('');
      onChangeSelectedIcon(undefined);
      setSelectedKind(DEFAULT_ACCOUNT_KIND);
      setInitialBalanceText('');
      showNotice('info', t('common.success'), t('accounts.form.created'));
      return true;
    } catch (e: any) {
      setError(t('accounts.form.saveError', {message: e.message}));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    mode,
    inputText,
    onChangeInputText,
    selectedIcon,
    handlePressItem,
    selectedKind,
    onChangeSelectedKind,
    initialBalanceText,
    onChangeInitialBalanceText,
    error,
    isSaving,
    canSave,
    saveAccount,
    loadStatus,
    loadErrorMessage,
    reloadAccount: loadAccount,
    notice,
    dismissNotice,
  };
};
