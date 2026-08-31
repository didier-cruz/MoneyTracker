import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '@redshank/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faArrowDownLong} from '@fortawesome/free-solid-svg-icons/faArrowDownLong';
import {faArrowUpLong} from '@fortawesome/free-solid-svg-icons/faArrowUpLong';
import {colors, primary} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';

export interface MiniStatProps {
  label: string;
  /** Magnitude in cents (`>= 0`) — always displayed as a plain amount,
   * never signed; `direction` is what carries the +/- meaning (see
   * `BalanceCard`'s caller, which resolves a signed `savings` figure
   * into `Math.abs(...)` + a flipped `direction` before this). */
  amountCents: number;
  /** This stat's brand color (lime/red/amber per the approved
   * prototype) — tints the leading direction arrow, the one and only
   * icon this component draws (see doc below on why there's no second,
   * "what kind of stat is this" icon). */
  color: string;
  direction: 'up' | 'down';
}

/**
 * One of the three "Income / Expense / Savings" mini-stats inside
 * `BalanceCard`'s indigo card, laid out exactly as the approved
 * prototype: a single 14px direction arrow on the LEFT, and to its
 * right a column with the label (11px, `colors.primary[1]` — the
 * muted lavender-gray this ramp's own doc comment calls out as
 * secondary text on an indigo background, NOT the lime
 * `colors.accent[0]` "Disponible" itself uses one level up) above the
 * bold white amount (14px).
 *
 * This is a deliberate SIMPLIFICATION from an earlier version of this
 * component, which drew a circular icon-chip (sack/cart/piggy-bank)
 * ABOVE the label plus a second, separate small arrow next to the
 * amount — two icons doing the job the prototype only ever asks one
 * of: `direction`'s arrow IS the icon here, nothing else. `icon` (the
 * old per-kind chip prop) is gone from this component's props
 * entirely, not just unused, since keeping a dead prop around would
 * mislead the next reader into thinking it still renders something.
 */
const MiniStat: FC<MiniStatProps> = ({label, amountCents, color, direction}) => {
  const accessibilityLabel = `${label}: ${formatCentsToCurrency(amountCents)}`;

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibilityLabel}>
      <FontAwesomeIcon
        icon={direction === 'up' ? faArrowUpLong : faArrowDownLong}
        color={color}
        size={14}
        style={styles.arrow}
      />
      <View style={styles.textColumn}>
        <Text color={colors[primary][1]} size={11}>
          {label}
        </Text>
        <Text color={colors.white[0]} size={14} fontWeight="600">
          {formatCentsToCurrency(amountCents)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    marginRight: 7,
  },
  textColumn: {
    flexShrink: 1,
  },
});

export default MiniStat;
