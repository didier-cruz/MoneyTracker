import {Text} from '@redshank/native';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {IAccountWithBalance} from '@db/queries';
import {colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useTranslation} from 'react-i18next';

type Props = {
  fromAccount: IAccountWithBalance;
  toAccount: IAccountWithBalance;
  /** `null` while the typed amount isn't valid yet — the preview then
   * falls back to each account's CURRENT balance (a $0.00 transfer
   * changes nothing), rather than hiding the block entirely; per the
   * task brief this preview should always be live against whatever is
   * currently typed. */
  amountCents: number | null;
};

// `colors.accent[3]` — the one shade in this app's lime scale picked
// specifically to stay legible over `colors.accent[0]` (see
// `src/constants/colors/colors.ts`'s own comment: accent[3] over
// accent[0] is the pairing that clears contrast, accent[2] does not).
const PREVIEW_TEXT_COLOR = colors.accent[3];

/**
 * "Después de transferir" — the approved prototype's light-lime
 * preview block, computed from each account's CURRENT derived balance
 * and the amount typed so far. No arithmetic happens anywhere else:
 * `getAccounts`'s `balance` is already the correct derived value, this
 * component only adds/subtracts the in-flight amount for a
 * before-you-confirm preview.
 */
const TransferPreview = ({fromAccount, toAccount, amountCents}: Props) => {
  const {t} = useTranslation();
  const delta = amountCents ?? 0;
  const previewFromBalance = fromAccount.balance - delta;
  const previewToBalance = toAccount.balance + delta;

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('transfer.previewAccessibilityLabel', {
        fromName: fromAccount.name,
        fromBalance: formatCentsToCurrency(previewFromBalance),
        toName: toAccount.name,
        toBalance: formatCentsToCurrency(previewToBalance),
      })}>
      <Text color={PREVIEW_TEXT_COLOR} bold size="sm" style={styles.title}>
        {t('transfer.previewTitle')}
      </Text>
      <View style={styles.row}>
        <View style={styles.column}>
          <Text color={PREVIEW_TEXT_COLOR} size="xs">
            {fromAccount.name}
          </Text>
          <Text
            color={previewFromBalance < 0 ? colors.error[0] : PREVIEW_TEXT_COLOR}
            bold
            size="base">
            {formatCentsToCurrency(previewFromBalance)}
          </Text>
        </View>
        <View style={styles.column}>
          <Text color={PREVIEW_TEXT_COLOR} size="xs">
            {toAccount.name}
          </Text>
          <Text
            color={previewToBalance < 0 ? colors.error[0] : PREVIEW_TEXT_COLOR}
            bold
            size="base">
            {formatCentsToCurrency(previewToBalance)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.accent[0],
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  title: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
});

export default TransferPreview;
