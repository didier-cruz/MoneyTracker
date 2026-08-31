import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import React from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  KeyboardContainer,
  ScreenContainer,
  ScrollContainer,
  Spacer,
} from '@components/atoms';
import {ConfirmDialog} from '@components/organisms/feedback';
import {AccountsNavParams} from '@navigation/[accounts]/AccountsNavigator/types';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {useTransferScreen} from '@hooks/useTransferScreen';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import AccountSelectorCard from './partials/AccountSelectorCard';
import TransferDivider from './partials/TransferDivider';
import AmountCard from './partials/AmountCard';
import TransferPreview from './partials/TransferPreview';
import AccountPickerModal from './partials/AccountPickerModal';
import {useTranslation} from 'react-i18next';

interface TransferProps extends NativeStackScreenProps<AccountsNavParams, 'Transfer'> {}

/**
 * Slice B3 — move money between two of the user's own accounts, the
 * mechanism lending money is built on (transferring INTO a `receivable`
 * account is lending; transferring back OUT of it is receiving a
 * repayment — see `insertTransfer`'s doc comment in `@db/queries`).
 * Closes Problem 01: "presta dinero y no recuerda los abonos ni los
 * retiros que le hacen".
 *
 * Follows the approved prototype for everything it actually draws:
 * chevron-back header with a `Title level={2}` (25px), one explanatory
 * line (moving money between your own accounts never changes your net
 * worth), the "Desde"/"Hacia" cards separated by the lime circle/
 * hairline divider, the indigo amount card, the light-lime "Después de
 * transferir" preview computed live from the CURRENT balances plus
 * whatever amount is typed, and a 70%-wide confirm button. Copy now
 * lives in `@i18n/locales/*.json` (`transfer.*`) like every other
 * screen — this file used to hardcode Spanish strings directly while
 * its siblings (`CreateAccount`/`ArchivedAccounts`) hardcoded English,
 * a pre-existing per-screen inconsistency this i18n pass resolved.
 *
 * What is NOT drawn by that prototype (the account picker sheet opened
 * by each card's chevron, and this screen's own loading/error/empty
 * states) is built with this app's existing vocabulary instead — see
 * `AccountPickerModal`'s own doc comment.
 */
export const Transfer = ({navigation}: TransferProps) => {
  const {t} = useTranslation();
  const {
    accounts,
    status,
    errorMessage,
    reload,
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
  } = useTransferScreen();

  const {notice, showNotice, dismissNotice} = useNoticeDialog();

  // Was `Alert.alert(...); navigation.goBack();` fired back to back —
  // a native `Alert` renders OUTSIDE the React tree, so it stayed on
  // screen even after `goBack()` popped this screen underneath it. A
  // JS-rendered `ConfirmDialog` would instead unmount WITH this screen,
  // so the equivalent behavior here is to wait for the dialog's own
  // dismissal before navigating back (see `onDismissDoneNotice`).
  const handleConfirm = async () => {
    const success = await submitTransfer();
    if (success) {
      showNotice('info', t('transfer.doneTitle'), t('transfer.doneMessage'));
    }
  };

  const onDismissDoneNotice = () => {
    dismissNotice();
    navigation.goBack();
  };

  const pickerAccounts = pickerTarget ? accountsForPicker(pickerTarget) : [];
  const pickerTitle =
    pickerTarget === 'from' ? t('transfer.pickFromTitle') : t('transfer.pickToTitle');

  return (
    <>
    <KeyboardContainer>
      <ScrollContainer>
        <ScreenContainer>
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('transfer.back')}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
              onPress={navigation.goBack}
              style={styles.backButton}>
              <VectorIcon name="chevron-left" color={colors[gray][1]} size={22} />
            </TouchableOpacity>
            <Title level={2}>{t('transfer.title')}</Title>
          </View>

          <Text color={colors[gray][0]} style={styles.explainer}>
            {t('transfer.explainer')}
          </Text>

          {status === 'loading' && (
            <View style={stateStyles.centered}>
              <ActivityIndicator
                size="large"
                color={colors[accent][2]}
                accessibilityLabel={t('transfer.loadingAccounts')}
              />
            </View>
          )}

          {status === 'error' && (
            <View style={stateStyles.centered}>
              <Text color={colors[secondary][0]} style={stateStyles.message}>
                {errorMessage}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('transfer.retryLoadingAccounts')}
                onPress={reload}
                style={stateStyles.retryButton}>
                <Text color={colors[white][0]}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'success' && accounts.length < 2 && (
            <View style={stateStyles.centered}>
              <Text color={colors[gray][0]} style={stateStyles.message}>
                {t('transfer.needTwoAccounts')}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('transfer.createAccount')}
                onPress={() => navigation.navigate('CreateAccount')}
                style={stateStyles.createButton}>
                <Text color={colors[accent][3]}>{t('transfer.createAccount')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'success' && accounts.length >= 2 && fromAccount && toAccount && (
            <>
              <Spacer space={15} />
              <AccountSelectorCard
                label={t('transfer.from')}
                account={fromAccount}
                onPress={() => openPicker('from')}
              />
              <TransferDivider />
              <AccountSelectorCard
                label={t('transfer.to')}
                account={toAccount}
                onPress={() => openPicker('to')}
              />

              <Spacer space={20} />
              <AmountCard
                amountText={amountText}
                onChangeAmountText={onChangeAmountText}
              />
              {amountError ? (
                <Text
                  color={colors[secondary][0]}
                  size="xs"
                  style={stateStyles.inlineError}>
                  {amountError}
                </Text>
              ) : null}

              <Spacer space={20} />
              <TransferPreview
                fromAccount={fromAccount}
                toAccount={toAccount}
                amountCents={amountCents}
              />

              {saveError ? (
                <Text
                  color={colors[secondary][0]}
                  style={stateStyles.inlineError}>
                  {saveError}
                </Text>
              ) : null}

              <View style={styles.confirmRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{disabled: !canSubmit}}
                  accessibilityLabel={t('transfer.confirmAccessibilityLabel')}
                  disabled={!canSubmit}
                  onPress={handleConfirm}
                  style={[
                    styles.confirmButton,
                    !canSubmit && styles.confirmButtonDisabled,
                  ]}>
                  <Text color={colors[accent][3]} bold>
                    {isSaving ? t('transfer.transferring') : t('transfer.transfer')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Spacer space={30} />

              <AccountPickerModal
                visible={pickerTarget !== null}
                title={pickerTitle}
                accounts={pickerAccounts}
                onSelect={selectAccount}
                onClose={closePicker}
              />
            </>
          )}
        </ScreenContainer>
      </ScrollContainer>
    </KeyboardContainer>

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={onDismissDoneNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={onDismissDoneNotice}
      />
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  backButton: {
    marginRight: 10,
  },
  // Was two styles (`explainer` + `explainerContainer`) because the old
  // `@redshank/native` `Text` wrapped its `TextNative` in an outer
  // `View` that only accepted `containerStyle`, never `style` — `style`'s
  // `width` landed on the INNER text node while the outer wrapper stayed
  // unconstrained, so inside `ScreenContainer` (`alignItems: 'center'`,
  // no stretch) the wrapper shrink-wrapped to the text's intrinsic
  // single-line width instead of the screen's, and the sentence
  // overflowed both edges in every language. `@components/atoms/text/Text`
  // renders the RN `Text` directly with no wrapper, so `width: '100%'`
  // here now bounds the text node itself — one style is enough.
  explainer: {
    width: '100%',
    marginBottom: 5,
  },
  confirmRow: {
    width: '100%',
    alignItems: 'center',
  },
  confirmButton: {
    width: '70%',
    height: 50,
    borderRadius: 15,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent[0],
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
});

const stateStyles = StyleSheet.create({
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  message: {
    paddingHorizontal: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    height: 44,
    minWidth: 120,
    borderRadius: 10,
    backgroundColor: colors[secondary][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    marginTop: 15,
    height: 44,
    minWidth: 150,
    borderRadius: 10,
    backgroundColor: colors[accent][0],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  inlineError: {
    width: '100%',
    marginTop: 8,
  },
});
