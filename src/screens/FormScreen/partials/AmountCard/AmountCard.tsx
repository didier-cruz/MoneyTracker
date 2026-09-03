import {colors, white} from '@constants/colors/colors';
import {IAccountWithBalance} from '@db/queries';
import React from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AccountSelector from '../AccountSelector/AccountSelector';

type Props = {
  amountText: string;
  onChangeAmountText: (text: string) => void;
  accounts: IAccountWithBalance[];
  selectedAccount: IAccountWithBalance | undefined;
  onSelectAccount: (account: IAccountWithBalance) => void;
  accountsStatus: 'loading' | 'success' | 'error';
  accountsErrorMessage: string;
};

// One-off hex not in `@constants/colors` — see `TypeSegment`'s own
// comment for why this card introduces a couple of these instead of a
// new shared token.
const AMOUNT_MUTED = '#9C9AC8';
// `rgba(199,255,112,0.28)` is `colors.accent[0]` (`#C7FF70`) at 28%
// alpha — the prototype's own hairline divider inside this card.
const DIVIDER_COLOR = 'rgba(199,255,112,0.28)';

/**
 * The indigo "monto" card from the approved prototype: label, `$` +
 * amount input, a lime hairline, and — per this task's brief — the
 * account selector embedded inside the card rather than floating below
 * it as a separate block.
 *
 * The prototype mocks the amount as static text with a lime caret bar
 * next to it; that bar is just how a static HTML mock represents an
 * active text cursor, not a persistent UI element. This renders a real
 * `TextInput` instead (`selectionColor` tints the NATIVE caret lime,
 * the closest real equivalent) so the amount stays actually editable.
 */
const AmountCard = ({
  amountText,
  onChangeAmountText,
  accounts,
  selectedAccount,
  onSelectAccount,
  accountsStatus,
  accountsErrorMessage,
}: Props) => {
  const {t} = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('form.amountLabel')}</Text>

      <View style={styles.amountRow}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          value={amountText}
          onChangeText={onChangeAmountText}
          placeholder="0,00"
          placeholderTextColor="rgba(255,255,255,0.35)"
          selectionColor={colors.accent[0]}
          keyboardType="decimal-pad"
          returnKeyType="done"
          accessibilityLabel={t('form.transactionAmount')}
          style={styles.amountInput}
        />
      </View>

      <View style={styles.divider} />

      <AccountSelector
        accounts={accounts}
        selectedAccount={selectedAccount}
        onSelectAccount={onSelectAccount}
        status={accountsStatus}
        errorMessage={accountsErrorMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.primary[0],
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 12,
    // Una sola declaracion para las dos plataformas: `shadow*` solo
    // servia en iOS y `elevation` solo en Android, y ademas esta
    // ultima dibujaba la sombra como un rectangulo bajo una tarjeta
    // redondeada.
    boxShadow: '0px 10px 22px rgba(1, 0, 98, 0.22)',
  },
  label: {
    fontSize: 12,
    color: colors.accent[0],
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 26,
    fontWeight: '600',
    color: AMOUNT_MUTED,
  },
  amountInput: {
    flex: 1,
    fontSize: 46,
    fontWeight: '700',
    color: colors[white][0],
    lineHeight: 52,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER_COLOR,
  },
});

export default AmountCard;
