import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '@redshank/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {faArrowDownLong} from '@fortawesome/free-solid-svg-icons/faArrowDownLong';
import {faArrowUpLong} from '@fortawesome/free-solid-svg-icons/faArrowUpLong';
import {colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';

export interface MiniStatProps {
  icon: IconDefinition;
  label: string;
  /** Magnitude in cents (`>= 0`) — always displayed as a plain amount,
   * never signed; `direction` is what carries the +/- meaning (see
   * `BalanceCard`'s caller, which resolves a signed `savings` figure
   * into `Math.abs(...)` + a flipped `direction` before this). */
  amountCents: number;
  /** This stat's brand color (lime/red/amber per the approved
   * prototype) — tints both the icon chip and the trailing arrow. */
  color: string;
  direction: 'up' | 'down';
}

/**
 * One of the three "Income / Expense / Savings" mini-stats inside
 * `BalanceCard`'s indigo card — icon chip (colored background at 20%
 * opacity, same convention `TransactItem`'s own icon chip already uses)
 * + label + amount + a small directional arrow, i.e. exactly the
 * "flecha e icono" (arrow AND icon) the approved prototype calls for,
 * built from the same visual grammar as this screen's own movement
 * rows below it rather than inventing a new one.
 */
const MiniStat: FC<MiniStatProps> = ({icon, label, amountCents, color, direction}) => {
  const accessibilityLabel = `${label}: ${formatCentsToCurrency(amountCents)}`;

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibilityLabel}>
      <View style={[styles.iconChip, {backgroundColor: `${color}33`}]}>
        <FontAwesomeIcon icon={icon} color={color} size={14} />
      </View>
      <Text color={colors.accent[0]} size={11} style={styles.label}>
        {label}
      </Text>
      <View style={styles.amountRow}>
        <Text color={colors.white[0]} size={13} bold>
          {formatCentsToCurrency(amountCents)}
        </Text>
        <FontAwesomeIcon
          icon={direction === 'up' ? faArrowUpLong : faArrowDownLong}
          color={color}
          size={10}
          style={styles.arrow}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    marginLeft: 4,
  },
});

export default MiniStat;
