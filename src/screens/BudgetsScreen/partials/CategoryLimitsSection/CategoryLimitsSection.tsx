import {FC} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@redshank/native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {ICategoryBudgetWithSpent} from '@db/queries';
import {accent, colors, gray, primary, secondary, white} from '@constants/colors/colors';
import {LoadStatus} from '@hooks/useBudgetsScreen';
import {CategoryLimitRow} from './CategoryLimitRow';
import {useTranslation} from 'react-i18next';

interface CategoryLimitsSectionProps {
  budgets: ICategoryBudgetWithSpent[];
  status: LoadStatus;
  errorMessage: string;
  onRetry: () => void;
  onPressBudget: (budget: ICategoryBudgetWithSpent) => void;
  onPressAddLimit: () => void;
}

/**
 * "Límites del mes" — one card holding every category with a spending
 * limit set for the current period, per the approved design (icon,
 * name, `spent / limit`, 8px progress bar, red over-limit message).
 * "Set a limit" always appears at the bottom, even with rows already
 * present — adding a SECOND (third, ...) category's limit is just as
 * common a next action as looking at the first one, not a one-time
 * empty-state-only affordance.
 */
export const CategoryLimitsSection: FC<CategoryLimitsSectionProps> = ({
  budgets,
  status,
  errorMessage,
  onRetry,
  onPressBudget,
  onPressAddLimit,
}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.heading} size={18} bold>
        {t('budgets.monthlyLimitsHeading')}
      </Text>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('budgets.loadingLimits')}
          />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <Text color={colors[secondary][0]} style={styles.message}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('budgets.retryLoadingLimits')}
            onPress={onRetry}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.card}>
          {budgets.length === 0 ? (
            <Text color={colors[gray][0]} style={styles.emptyMessage}>
              {t('budgets.limitsEmptyState')}
            </Text>
          ) : (
            budgets.map(budget => (
              <CategoryLimitRow
                key={budget.id}
                budget={budget}
                onPress={() => onPressBudget(budget)}
              />
            ))
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('budgets.setNewLimit')}
            onPress={onPressAddLimit}
            style={styles.addLimitButton}>
            <VectorIcon name="plus" color={colors[primary][0]} size={14} />
            <Text color={colors[primary][0]} size={13} style={styles.addLimitLabel}>
              {t('budgets.setLimit')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  heading: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
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
  card: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderRadius: 20,
    backgroundColor: colors[white][0],
    elevation: 4,
  },
  emptyMessage: {
    paddingVertical: 16,
    textAlign: 'center',
  },
  addLimitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addLimitLabel: {
    marginLeft: 8,
  },
});

export default CategoryLimitsSection;
