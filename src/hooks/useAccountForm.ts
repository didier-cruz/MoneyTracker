import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {AccountKind, getAccountById, insertAccount, updateAccount} from '@db/queries';
import {formatCentsToCurrency, parseInitialBalanceToCents} from '@utils/currency';
import {toIcon} from '@data/iconCatalog';
import {useNoticeDialog} from '@hooks/useNoticeDialog';

const DEFAULT_ACCOUNT_KIND: AccountKind = 'cash';

export type AccountFormMode = 'create' | 'edit';
export type AccountFormLoadStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * A que campo pertenece el error que se esta mostrando. `form` es para
 * los que no cuelgan de ningun input —falta de icono, fallo al
 * guardar— y la pantalla los pinta junto al boton de guardar.
 */
export type AccountFormErrorField = 'name' | 'amount' | 'form';
type AccountFormError = {field: AccountFormErrorField; message: string};

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

  // Un solo error a la vez, ETIQUETADO con el campo al que pertenece.
  // Antes era un `string` suelto que la pantalla pintaba siempre bajo el
  // input del nombre, asi que "Saldo inicial no valido" aparecia debajo
  // de un nombre correcto. Mismo arreglo que `useEnvelopeForm`.
  const [formError, setFormError] = useState<AccountFormError | null>(null);

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
      // `toIcon` resuelve el id contra el catalogo COMPLETO. Antes se
      // buscaba solo entre los 16 fijos y cualquier otro icono entraba
      // con id -1, asi que al editar no aparecia marcado en la rejilla.
      onChangeSelectedIcon(toIcon(account.icon));
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

  // Cada error se borra en cuanto el usuario toca el campo del que
  // hablaba: dejarlo puesto mientras se corrige el valor hace que la
  // pantalla contradiga lo que se esta escribiendo.
  const clearErrorFor = (field: AccountFormErrorField) =>
    setFormError(current => (current?.field === field ? null : current));

  const onChangeInputText = (text: string) => {
    clearErrorFor('name');
    setInputText(text);
  };

  const onChangeSelectedKind = (kind: AccountKind) => {
    setSelectedKind(kind);
  };

  const onChangeInitialBalanceText = (text: string) => {
    clearErrorFor('amount');
    setInitialBalanceText(text);
  };

  const handlePressItem = (id: number, icon: string) => {
    clearErrorFor('form');
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
      setFormError({field: 'name', message: t('accounts.form.nameRequired')});
      return false;
    }
    if (!selectedIcon) {
      setFormError({field: 'form', message: t('accounts.form.iconRequired')});
      return false;
    }
    const initialBalance = parseInitialBalanceToCents(initialBalanceText);
    if (initialBalance === null) {
      setFormError({field: 'amount', message: t('accounts.form.invalidInitialBalance')});
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
        setFormError(null);
        showNotice('info', t('common.success'), t('accounts.form.updated'));
        return true;
      }
      await insertAccount(db, {
        name: inputText.trim(),
        icon: selectedIcon.icon,
        kind: selectedKind,
        initialBalance,
      });
      setFormError(null);
      setInputText('');
      onChangeSelectedIcon(undefined);
      setSelectedKind(DEFAULT_ACCOUNT_KIND);
      setInitialBalanceText('');
      showNotice('info', t('common.success'), t('accounts.form.created'));
      return true;
    } catch (e: any) {
      setFormError({field: 'form', message: t('accounts.form.saveError', {message: e.message})});
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
    nameError: formError?.field === 'name' ? formError.message : '',
    amountError: formError?.field === 'amount' ? formError.message : '',
    formError: formError?.field === 'form' ? formError.message : '',
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
