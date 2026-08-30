import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '@redshank/native';
import {faSackDollar} from '@fortawesome/free-solid-svg-icons/faSackDollar';
import {faCartShopping} from '@fortawesome/free-solid-svg-icons/faCartShopping';
import {faPiggyBank} from '@fortawesome/free-solid-svg-icons/faPiggyBank';
import {colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {MiniStat} from '@components/atoms/items/MiniStat';
import {useTranslation} from 'react-i18next';

export interface BalanceCardProps {
  /** `getNetWorth`'s value — an all-time snapshot, always shown as-is
   * (never hidden, even on a screen otherwise in its "no movements yet"
   * empty state — an account can carry a non-zero initial balance
   * before a single movement is ever logged). */
  availableCents: number;
  /** This calendar month's totals — see
   * `mappers.ts#getCurrentMonthCashFlow`. `income`/`expense` are
   * magnitudes (`>= 0`); `savings` is signed (a net fund withdrawal for
   * the month renders as a down arrow). */
  incomeCents: number;
  expenseCents: number;
  savingsCents: number;
}

/**
 * The indigo "Available" card from the approved prototype — headline
 * net worth plus a row of three mini-stats (Income/Expense/Savings) for
 * THIS calendar month, using the brand's three fixed series tokens
 * (lime/red/amber — same tokens `CashFlowChart` plots its bars with).
 */
const BalanceCard: FC<BalanceCardProps> = ({
  availableCents,
  incomeCents,
  expenseCents,
  savingsCents,
}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.card}>
      <Text color={colors.accent[0]} size={12} style={styles.label}>
        {t('resumen.available')}
      </Text>
      <Text color={colors.white[0]} style={styles.amount}>
        {formatCentsToCurrency(availableCents)}
      </Text>
      <View style={styles.statsRow}>
        <MiniStat
          icon={faSackDollar}
          label={t('resumen.income')}
          amountCents={incomeCents}
          color={colors.accent[1]}
          direction="up"
        />
        <MiniStat
          icon={faCartShopping}
          label={t('resumen.expense')}
          amountCents={expenseCents}
          color={colors.error[0]}
          direction="down"
        />
        <MiniStat
          icon={faPiggyBank}
          label={t('resumen.savings')}
          amountCents={Math.abs(savingsCents)}
          color={colors.warning[0]}
          direction={savingsCents >= 0 ? 'up' : 'down'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.primary[0],
    borderRadius: 20,
    padding: 20,
    // Android-only elevation, same convention `EnvelopeCard` (this
    // codebase's other custom-shadow card) already uses — see this
    // screen's HANDOFF for why iOS gets no matching `shadow*` (an
    // existing gap in this codebase, not introduced here).
    elevation: 8,
  },
  label: {
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  amount: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default BalanceCard;
