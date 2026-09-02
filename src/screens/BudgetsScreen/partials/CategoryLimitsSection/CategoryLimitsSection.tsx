import {FC} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
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
  /** Right-hand subtitle next to the section heading, per the approved
   * prototype ("Quedan 9 días") — see `getDaysRemainingInMonth`. */
  daysRemainingInMonth: number;
  onRetry: () => void;
  onPressBudget: (budget: ICategoryBudgetWithSpent) => void;
  onDeleteBudget: (budget: ICategoryBudgetWithSpent) => void;
  onPressAddLimit: () => void;
  /**
   * Cuantas categorias de gasto quedan SIN limite este mes
   * (`useBudgetsScreen.categoriesWithoutBudget`). Cuando es 0 no hay
   * nada que anadir, asi que el boton se oculta en lugar de abrir una
   * hoja vacia.
   */
  categoriesWithoutLimitCount: number;
}

/**
 * "Límites del mes" — one card holding every category with a spending
 * limit set for the current period, per the approved design (icon,
 * name, `spent / limit`, 8px progress bar, red over-limit message).
 * "Set a limit" sits at the bottom even with rows already present —
 * adding a SECOND (third, ...) category's limit is just as common a
 * next action as looking at the first one, not a one-time
 * empty-state-only affordance.
 *
 * It disappears only when there is genuinely nothing left to add:
 * every expense category already has a limit this month. Before, it
 * stayed and opened a sheet whose only content was "todas las
 * categorías ya tienen límite" — a button whose sole outcome was
 * telling the user it should not have been there.
 *
 * The same count of 0 also happens when there are NO expense
 * categories at all, which is a different problem with a different way
 * out, so the empty state says so instead of leaving a dead end.
 */
export const CategoryLimitsSection: FC<CategoryLimitsSectionProps> = ({
  budgets,
  status,
  errorMessage,
  daysRemainingInMonth,
  onRetry,
  onPressBudget,
  onDeleteBudget,
  onPressAddLimit,
  categoriesWithoutLimitCount,
}) => {
  const {t} = useTranslation();
  const canAddLimit = categoriesWithoutLimitCount > 0;
  // Sin limites Y sin categorias que puedan tenerlos: no es que falte
  // configurar uno, es que antes hay que crear una categoria de gasto.
  const hasNoCategoriesAtAll = budgets.length === 0 && !canAddLimit;
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text size={18} bold>
          {t('budgets.monthlyLimitsHeading')}
        </Text>
        <Text color={colors[gray][0]} size={12}>
          {t('budgets.daysRemaining', {count: daysRemainingInMonth})}
        </Text>
      </View>

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
        <View style={[styles.card, !canAddLimit && styles.cardWithoutAction]}>
          {budgets.length === 0 ? (
            <Text color={colors[gray][0]} style={styles.emptyMessage}>
              {hasNoCategoriesAtAll
                ? t('budgets.noExpenseCategories')
                : t('budgets.limitsEmptyState')}
            </Text>
          ) : (
            budgets.map((budget, index) => (
              <CategoryLimitRow
                key={budget.id}
                budget={budget}
                onPress={() => onPressBudget(budget)}
                onDelete={() => onDeleteBudget(budget)}
                showSeparator={canAddLimit || index < budgets.length - 1}
              />
            ))
          )}

          {canAddLimit && (
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
          )}
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
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  message: {
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
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderRadius: 20,
    backgroundColor: colors[white][0],
    elevation: 4,
  },
  // Sin el boton, la tarjeta necesita su propio aire abajo: el
  // `paddingBottom: 4` de arriba contaba con los 14 del boton.
  cardWithoutAction: {
    paddingBottom: 14,
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
