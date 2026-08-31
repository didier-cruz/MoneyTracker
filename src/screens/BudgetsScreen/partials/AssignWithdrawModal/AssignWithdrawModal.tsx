import {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, View} from 'react-native';
import {BottomSheet} from '@components/organisms/feedback/BottomSheet';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import InputField from '@screens/[categories]/CreateCategory/partials/InputField/InputField';
import SaveAction from '@screens/[categories]/CreateCategory/partials/SaveAction/SaveAction';
import {IEnvelopeWithBalance} from '@db/queries';
import {colors, gray} from '@constants/colors/colors';
import {formatCentsToCurrency, parseAmountToCents} from '@utils/currency';
import {useTranslation} from 'react-i18next';

export type AssignWithdrawMode = 'assign' | 'withdraw';

interface AssignWithdrawModalProps {
  visible: boolean;
  mode: AssignWithdrawMode;
  envelope: IEnvelopeWithBalance | null;
  /** `getAvailableToAssign`'s current value — informational context for
   * `mode === 'assign'` only, see this component's doc comment. */
  availableToAssign: number;
  isSubmitting: boolean;
  onSubmit: (amount: number) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet amount entry for BOTH "assign money to" and "withdraw
 * money from" one envelope — not part of the approved `BudgetsScreen`
 * prototype (that mock only shows the cards themselves, no interaction
 * for changing a balance), built on the shared `BottomSheet` rather
 * than inventing new modal chrome. Flagged for design review in this
 * slice's HANDOFF.
 *
 * Was `@redshank/native`'s `Modal`, reusing `AccountPickerModal`'s old
 * shape — see that component's doc comment (and the `@redshank/native`
 * removal slice's HANDOFF) for why its `BackHandler` listener is gone
 * here too, not ported: `BottomSheet` renders RN's OWN `Modal` with
 * `onRequestClose` already wired to `onClose`, which RN wires to
 * Android's hardware back button natively.
 *
 * Deliberately does NOT block on `availableToAssign`/the envelope's own
 * `balance` — assigning more than is currently available, or
 * withdrawing more than the envelope currently holds, is allowed by
 * `assignToEnvelope`/`withdrawFromEnvelope` on purpose (see
 * `envelopesQueries.ts`'s top-of-file doc). This modal shows the
 * relevant number as CONTEXT only ("$X available to assign" /
 * "Current balance: $X"), never disables `SaveAction`, and never shows
 * an inline "not enough" error — any resulting `overAllocated`/
 * `envelopeOverdrawn` notice is `BudgetsScreen`'s job to show AFTER a
 * successful submit, not this modal's job to warn about before one.
 */
export const AssignWithdrawModal = ({
  visible,
  mode,
  envelope,
  availableToAssign,
  isSubmitting,
  onSubmit,
  onClose,
}: AssignWithdrawModalProps) => {
  const {t} = useTranslation();
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState('');

  // Every time a DIFFERENT envelope/mode opens this sheet, start from a
  // blank amount — a leftover value from the previous open (a different
  // envelope, or "assign" left over from "withdraw") would silently
  // apply to the wrong envelope/direction otherwise.
  useEffect(() => {
    if (visible) {
      setAmountText('');
      setError('');
    }
  }, [visible, envelope?.id, mode]);

  if (!envelope) {
    return null;
  }

  const title =
    mode === 'assign'
      ? t('budgets.assignToTitle', {name: envelope.name})
      : t('budgets.withdrawFromTitle', {name: envelope.name});
  const contextLine =
    mode === 'assign'
      ? t('budgets.availableToAssignContext', {amount: formatCentsToCurrency(availableToAssign)})
      : t('budgets.currentBalanceContext', {amount: formatCentsToCurrency(envelope.balance)});

  const handleSubmit = () => {
    const amount = parseAmountToCents(amountText);
    if (amount === null) {
      setError(t('budgets.invalidAmount'));
      return;
    }
    setError('');
    onSubmit(amount);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Title level={4} style={styles.title}>
          {title}
        </Title>
        <Text color={colors[gray][0]} size={12} style={styles.context}>
          {contextLine}
        </Text>
        <InputField
          inputText={amountText}
          onChangeInputText={setAmountText}
          placeholder={t('budgets.amountPlaceholder')}
          accessibilityLabel={t('budgets.amountAccessibilityLabel')}
          keyboardType="decimal-pad"
          error={error}
        />
        <View style={styles.actions}>
          <SaveAction onSave={handleSubmit} disabled={isSubmitting} />
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  // `BottomSheet`'s panel carries no horizontal padding of its own
  // (`ActionSheet` pads each row individually) — this sheet has no
  // rows, just a single padded block, so the inset lives here instead.
  content: {
    width: '100%',
    paddingHorizontal: 20,
  },
  title: {
    marginBottom: 4,
  },
  context: {
    marginBottom: 15,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
});

export default AssignWithdrawModal;
