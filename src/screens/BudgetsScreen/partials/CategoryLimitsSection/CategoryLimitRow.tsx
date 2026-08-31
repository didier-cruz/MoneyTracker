import {FC} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {ICategoryBudgetWithSpent} from '@db/queries';
import {ProgressBar} from '@components/atoms';
import {colors, primary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {getCategoryBudgetProgress} from '../../mappers';
import {useTranslation} from 'react-i18next';

interface CategoryLimitRowProps {
  budget: ICategoryBudgetWithSpent;
  onPress: () => void;
}

/**
 * One row of "Límites del mes" — icon, category name, `spent / limit`
 * right-aligned, an 8px traffic-light progress bar, and (only when
 * over) the red "You went over by $X this month." message the approved
 * design calls out explicitly. Color/over-message are entirely
 * `getCategoryBudgetProgress`'s call (see `mappers.ts`) — this row only
 * renders whatever state it returns.
 *
 * The whole row is one button into `CategoryLimitModal`'s edit mode —
 * same "tap the item to manage it" idiom `EnvelopeCard` uses, chosen
 * for the same reason: there is no separate "detail" view for a budget
 * row to open into first.
 */
export const CategoryLimitRow: FC<CategoryLimitRowProps> = ({budget, onPress}) => {
  const {t} = useTranslation();
  const {ratio, color, overMessage} = getCategoryBudgetProgress(budget);
  const spentOverLimit = `${formatCentsToCurrency(budget.spent)} / ${formatCentsToCurrency(
    budget.limitAmount,
  )}`;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${budget.category.name}, ${spentOverLimit}${
        overMessage ? `, ${overMessage}` : ''
      }`}
      accessibilityHint={t('budgets.limitRowAccessibilityHint')}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.row}>
      <View style={styles.topLine}>
        <View style={styles.nameGroup}>
          <View style={styles.icon}>
            <VectorIcon name={budget.category.icon} color={colors[white][0]} size={14} />
          </View>
          <Text lines={1} style={styles.name}>
            {budget.category.name}
          </Text>
        </View>
        <Text
          color={overMessage ? colors.error[0] : undefined}
          size={13}>
          {spentOverLimit}
        </Text>
      </View>
      <ProgressBar
        progress={ratio}
        height={8}
        color={color}
        style={styles.progress}
        accessibilityLabel={spentOverLimit}
      />
      {overMessage && (
        <Text color={colors.error[0]} size={12}>
          {overMessage}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.inactive[0],
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 10,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors[primary][0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  name: {
    flexShrink: 1,
  },
  progress: {
    marginBottom: 4,
  },
});

export default CategoryLimitRow;
