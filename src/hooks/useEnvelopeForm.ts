import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {
  EnvelopeKind,
  getEnvelopeById,
  insertEnvelope,
  updateEnvelope,
} from '@db/queries';
import {formatCentsToCurrency, parseAmountToCents} from '@utils/currency';
import {icons} from '@data/icons';
import {useNoticeDialog} from '@hooks/useNoticeDialog';

const DEFAULT_ENVELOPE_KIND: EnvelopeKind = 'fund';

export type EnvelopeFormMode = 'create' | 'edit';
export type EnvelopeFormLoadStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * A que campo pertenece el error que se esta mostrando. `form` es para
 * los que no cuelgan de ningun input —falta de icono, fallo al
 * guardar— y la pantalla los pinta junto al boton de guardar.
 */
export type EnvelopeFormErrorField = 'name' | 'amount' | 'form';
type EnvelopeFormError = {field: EnvelopeFormErrorField; message: string};

/** Same trick `useAccountForm`'s own (unexported) helper uses: strip
 * `formatCentsToCurrency`'s "$"/commas so its output can seed the same
 * editable `decimal-pad` field that `parseAmountToCents` later
 * re-parses on save. Duplicated here rather than imported — this
 * slice's scope is new hooks only, not edits to `useAccountForm.ts`. */
const centsToEditableAmountText = (cents: number): string =>
  formatCentsToCurrency(Math.abs(cents)).replace(/[$,]/g, '');

/**
 * Form state for creating OR editing an envelope — same shape/spirit as
 * `useAccountForm`, adapted to `envelopes`' fields (`kind`,
 * `targetAmount`) instead of `accounts`' (`kind`, `initialBalance`).
 *
 * `kind` is only meaningful in CREATE mode: `updateEnvelope` has no
 * `kind` field at all (see its doc comment — flipping a `fund` into a
 * `debt` mid-life would silently change what every past movement
 * already recorded against it means), so this hook never attempts to
 * send it on an edit save, and `CreateEnvelope`'s `KindField` renders
 * read-only (not editable) once `mode === 'edit'`.
 *
 * Pass an `envelopeId` to switch into edit mode: the hook loads that
 * envelope (`getEnvelopeById`) and prefills every field before the form
 * is usable, and `saveEnvelope` calls `updateEnvelope` instead of
 * `insertEnvelope` on save.
 */
export const useEnvelopeForm = (envelopeId?: number) => {
  const {t} = useTranslation();
  const mode: EnvelopeFormMode = envelopeId !== undefined ? 'edit' : 'create';

  // Same fix as `useAccountForm` — see that hook's doc comment for why
  // this state (not `Alert.alert`) is how a hook shows a save
  // success/failure notice; `CreateEnvelope` owns the `<ConfirmDialog>`.
  const {notice, showNotice, dismissNotice} = useNoticeDialog();

  const [inputText, setInputText] = useState<string>('');
  const [selectedIcon, onChangeSelectedIcon] = useState<IIcon>();
  const [selectedKind, setSelectedKind] = useState<EnvelopeKind>(DEFAULT_ENVELOPE_KIND);
  const [targetAmountText, setTargetAmountText] = useState<string>('');
  // Un solo error a la vez, ETIQUETADO con el campo al que pertenece.
  // Antes era un `string` suelto que la pantalla pintaba siempre bajo el
  // input del nombre, asi que "Ingresa una meta de ahorro valida" salia
  // debajo de un nombre perfectamente valido y el usuario no tenia forma
  // de saber que le hablaban del otro campo.
  const [formError, setFormError] = useState<EnvelopeFormError | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Same reasoning as `useAccountForm.loadStatus`: edit mode needs a
  // real DB read before the form has anything to prefill.
  const [loadStatus, setLoadStatus] = useState<EnvelopeFormLoadStatus>(
    mode === 'edit' ? 'loading' : 'idle',
  );
  const [loadErrorMessage, setLoadErrorMessage] = useState('');

  const loadEnvelope = useCallback(async () => {
    if (envelopeId === undefined) {
      return;
    }
    setLoadStatus('loading');
    setLoadErrorMessage('');
    try {
      const db = await getDbConnection();
      const envelope = await getEnvelopeById(db, envelopeId);
      if (!envelope) {
        setLoadErrorMessage(t('budgets.envelopeForm.notFound'));
        setLoadStatus('error');
        return;
      }
      setInputText(envelope.name);
      const matchedIcon = icons.find(i => i.icon === envelope.icon);
      onChangeSelectedIcon(matchedIcon ?? {id: -1, icon: envelope.icon});
      setSelectedKind(envelope.kind);
      setTargetAmountText(
        envelope.targetAmount !== null
          ? centsToEditableAmountText(envelope.targetAmount)
          : '',
      );
      setLoadStatus('success');
    } catch (e: any) {
      setLoadErrorMessage(
        t('budgets.envelopeForm.loadError', {message: e?.message ?? t('common.unknownError')}),
      );
      setLoadStatus('error');
    }
  }, [envelopeId, t]);

  useEffect(() => {
    loadEnvelope();
  }, [loadEnvelope]);

  // Cada error se borra en cuanto el usuario toca el campo del que
  // hablaba: dejarlo puesto mientras se corrige el valor hace que la
  // pantalla contradiga lo que se esta escribiendo.
  const clearErrorFor = (field: EnvelopeFormErrorField) =>
    setFormError(current => (current?.field === field ? null : current));

  const onChangeInputText = (text: string) => {
    clearErrorFor('name');
    setInputText(text);
  };
  const onChangeSelectedKind = (kind: EnvelopeKind) => {
    // El texto de error del importe depende del tipo (meta de ahorro
    // frente a deuda), asi que al cambiar de tipo deja de aplicar.
    clearErrorFor('amount');
    setSelectedKind(kind);
  };
  const onChangeTargetAmountText = (text: string) => {
    clearErrorFor('amount');
    setTargetAmountText(text);
  };
  const handlePressItem = (id: number, icon: string) => {
    clearErrorFor('form');
    onChangeSelectedIcon({id, icon});
  };

  // Drives `SaveAction`'s `disabled` state — same shape as
  // `useAccountForm.canSave`. Amount validity itself is only checked at
  // submit time (`saveEnvelope`), same as `useAccountForm` does for
  // `initialBalanceText` — it needs the specific fund-vs-debt error
  // copy below, which a boolean can't carry.
  const canSave = inputText.trim() !== '' && !!selectedIcon && !isSaving;

  /** Returns `true` on success, `false` on a validation/save failure —
   * lets the screen decide what to do next without this hook reaching
   * into navigation itself. */
  const saveEnvelope = async (): Promise<boolean> => {
    if (inputText.trim() === '') {
      setFormError({field: 'name', message: t('budgets.envelopeForm.nameRequired')});
      return false;
    }
    if (!selectedIcon) {
      setFormError({field: 'form', message: t('budgets.envelopeForm.iconRequired')});
      return false;
    }

    const trimmedAmount = targetAmountText.trim();
    let targetAmount: number | null | undefined;
    if (trimmedAmount === '') {
      if (selectedKind === 'debt') {
        setFormError({field: 'amount', message: t('budgets.envelopeForm.debtAmountRequired')});
        return false;
      }
      // `fund`: no goal set (create) / goal cleared (edit).
      targetAmount = mode === 'edit' ? null : undefined;
    } else {
      const parsed = parseAmountToCents(trimmedAmount);
      if (parsed === null) {
        setFormError({
          field: 'amount',
          message:
            selectedKind === 'debt'
              ? t('budgets.envelopeForm.invalidDebtAmount')
              : t('budgets.envelopeForm.invalidGoalAmount'),
        });
        return false;
      }
      targetAmount = parsed;
    }

    setIsSaving(true);
    try {
      const db = await getDbConnection();
      if (mode === 'edit' && envelopeId !== undefined) {
        await updateEnvelope(db, envelopeId, {
          name: inputText.trim(),
          icon: selectedIcon.icon,
          targetAmount,
        });
        setFormError(null);
        showNotice('info', t('common.success'), t('budgets.envelopeForm.updated'));
        return true;
      }
      await insertEnvelope(db, {
        name: inputText.trim(),
        icon: selectedIcon.icon,
        kind: selectedKind,
        targetAmount: targetAmount ?? undefined,
      });
      setFormError(null);
      setInputText('');
      onChangeSelectedIcon(undefined);
      setSelectedKind(DEFAULT_ENVELOPE_KIND);
      setTargetAmountText('');
      showNotice('info', t('common.success'), t('budgets.envelopeForm.created'));
      return true;
    } catch (e: any) {
      setFormError({field: 'form', message: t('budgets.envelopeForm.saveError', {message: e.message})});
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
    targetAmountText,
    onChangeTargetAmountText,
    nameError: formError?.field === 'name' ? formError.message : '',
    amountError: formError?.field === 'amount' ? formError.message : '',
    formError: formError?.field === 'form' ? formError.message : '',
    isSaving,
    canSave,
    saveEnvelope,
    loadStatus,
    loadErrorMessage,
    reloadEnvelope: loadEnvelope,
    notice,
    dismissNotice,
  };
};
