import {colors, gray, white} from '@constants/colors/colors';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';

export type TransactionType = 'expense' | 'income';

type Props = {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
};

// `#EDEDF2` (segment track) has no equivalent in `@constants/colors` —
// it's a one-off neutral specific to this control, same precedent as
// `ArchivedAccounts.tsx`'s own `#373737` ad hoc hex. `colors.error[0]`
// (`#BC2424`) and `colors.success[0]` (`#50B700`) below are NOT
// one-offs: they're the exact same expense-is-red/income-is-green
// pairing already used everywhere money is signed (`TransactItem`,
// the Cuentas/Categorías/Resumen mappers) — the prototype only drew
// the "Gasto" state active, but reusing this app's existing color
// language for "Ingreso" active keeps it consistent rather than
// inventing a new meaning for green/red on this one screen.
const SEGMENT_TRACK_BG = '#EDEDF2';

/**
 * The Gasto/Ingreso segmented control from the approved prototype —
 * new in this pass; the transaction type used to be derived silently
 * from whichever category the user tapped. See `useFormScreen`'s
 * `selectType` for how this now interacts with category selection.
 */
export const TypeSegment = ({value, onChange}: Props) => {
  const {t} = useTranslation();

  const renderPill = (type: TransactionType, label: string, activeColor: string) => {
    const isActive = value === type;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{selected: isActive}}
        hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}
        style={[styles.pill, isActive && styles.pillActive]}
        onPress={() => onChange(type)}>
        <Text
          style={[
            styles.pillText,
            {color: isActive ? activeColor : colors[gray][0]},
            isActive && styles.pillTextActive,
          ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.track}>
      {renderPill('expense', t('form.segmentExpense'), colors.error[0])}
      {renderPill('income', t('form.segmentIncome'), colors.success[0])}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: SEGMENT_TRACK_BG,
    borderRadius: 14,
    padding: 4,
  },
  pill: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors[white][0],
    shadowColor: 'black',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextActive: {
    fontWeight: '700',
  },
});

export default TypeSegment;
