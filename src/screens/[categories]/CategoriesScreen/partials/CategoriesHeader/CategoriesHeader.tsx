import {FC} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {colors, gray, primary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {LoadStatus} from '@hooks/useCategoriesScreen';
import {useTranslation} from 'react-i18next';

interface CategoriesHeaderProps {
  financeType: FinanceType;
  totalForPeriod: number;
  status: LoadStatus;
}

/**
 * Per-tab copy for the icon/title/help-line/total block — distinct from
 * the shared "List Categories" `Header` the navigator renders ABOVE the
 * tab bar (`CategoriesTopTabsNavigator`); that one is a single static
 * title for both tabs, this one is per-tab content that actually
 * differs (Expenses vs Incomes have different totals to show and, per
 * this slice's own visual call, different meaning for that total —
 * see `totalLabel`/`totalColor` below).
 *
 * `totalLabel`/`totalColor` for `incomes` are this slice's own decision
 * flagged for review: the approved prototype's "total spent this month,
 * 32px red" is inherently an EXPENSE concept ("spent"), and was only
 * shown for one tab in the mock. Rather than reusing a red "spent"
 * figure on the Incomes tab (which would misread as a loss), this
 * mirrors the same treatment with the obvious income-side equivalent —
 * "Earned this month" in `success` green — so the header stays
 * meaningful on both tabs instead of copying a mismatched label/color.
 */
/** Non-text visuals per tab — translated copy is read separately via
 * `t()` below (`categories.tabCopy.<financeType>.*`) so both locales
 * stay in sync through the JSON files rather than a second hardcoded
 * object here. */
const VISUALS: Record<FinanceType, {icon: string; totalColor: string}> = {
  expenses: {
    icon: 'arrow-circle-down',
    totalColor: colors.secondary[0],
  },
  incomes: {
    icon: 'arrow-circle-up',
    totalColor: colors.success[0],
  },
};

export const CategoriesHeader: FC<CategoriesHeaderProps> = ({
  financeType,
  totalForPeriod,
  status,
}) => {
  const {t} = useTranslation();
  const visuals = VISUALS[financeType];
  const copy = {
    ...visuals,
    title: t(`categories.tabCopy.${financeType}.title`),
    help: t(`categories.tabCopy.${financeType}.help`),
    totalLabel: t(`categories.tabCopy.${financeType}.totalLabel`),
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.iconBox}>
          <VectorIcon name={copy.icon} color={colors[white][0]} size={22} />
        </View>
        <Title level={2} style={styles.title}>
          {copy.title}
        </Title>
      </View>

      <Text color={colors[gray][0]} size={13} style={styles.help}>
        {copy.help}
      </Text>

      <View style={styles.totalBlock} accessible accessibilityRole="text">
        <Text color={colors[gray][0]} size={12}>
          {copy.totalLabel}
        </Text>
        {status === 'loading' && (
          <ActivityIndicator
            size="small"
            color={copy.totalColor}
            accessibilityLabel={t('categories.loadingTotal', {label: copy.totalLabel})}
            style={styles.totalSpinner}
          />
        )}
        {status === 'success' && (
          <Text color={copy.totalColor} size={32} bold>
            {formatCentsToCurrency(totalForPeriod)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors[primary][0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    flexShrink: 1,
    marginBottom: 0,
  },
  help: {
    marginTop: 4,
  },
  totalBlock: {
    marginTop: 16,
  },
  totalSpinner: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});

export default CategoriesHeader;
