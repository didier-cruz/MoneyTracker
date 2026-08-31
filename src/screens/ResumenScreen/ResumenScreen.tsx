import {ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {BalanceCard} from '@components/molecules/Cards/BalanceCard';
import {TransactCard} from '@components/molecules/Cards/TransactCard';
import {CashFlowChart} from '@components/organisms/Charts/CashFlowChart';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {useResumenScreen} from '@hooks/useResumenScreen';
import {getCurrentMonthCashFlow, mapFinancesToTransactItems} from './mappers';
import {useTranslation} from 'react-i18next';

/**
 * Just the two SIBLING tab names this screen navigates to — not a real
 * `ParamList` for `HomeBottomTabs` (that navigator is built with
 * `createBottomTabNavigator()` with no generic, see `ResumenScreen`'s
 * own doc comment below for why there is no typed alternative to reach
 * for instead). Declared locally so `navigation.navigate(...)` is at
 * least checked against these two literal names, rather than casting
 * past the type system entirely.
 */
type SiblingTabParamList = {
  Outcomes: undefined;
  Accounts: undefined;
};

/**
 * "Resumen" — the app's Dashboard: an all-time "Available" snapshot plus
 * this month's income/expense/savings (the indigo `BalanceCard`), the
 * last six months of cash flow as a grouped bar chart (`CashFlowChart`),
 * and a small preview of the most recent movements (`TransactCard`).
 * Every number here comes from `useResumenScreen` (`@db/queries` under
 * the hood) — this was the last main screen still rendering
 * `partials/chartData.ts`/`transactData.ts` static mocks (both now
 * deleted, slice B4).
 *
 * A brand-new install (no movements, no cash-flow months at all) is a
 * DELIBERATE dedicated empty state on both the chart and the movements
 * card — guiding the user to log their first movement — rather than a
 * broken axis or a silent "$0.00" list; see `CashFlowChart`'s own doc
 * and `renderMovements` below. The balance card itself is NOT part of
 * that empty state and always renders: an account can carry a non-zero
 * initial balance before a single movement is ever logged, so hiding
 * "Available" in that case would hide a true number behind an empty
 * state meant for a DIFFERENT question ("do I have any activity yet").
 *
 * "See all" (Movements) and the CTA in the movements empty state both
 * hop to a SIBLING tab (`Accounts`/`Outcomes`) via a plain, untyped
 * `useNavigation()` — this screen's own bottom-tab navigator
 * (`HomeBottomTabs`) is built with `createBottomTabNavigator()` with no
 * `ParamList` generic and no `ReactNavigation.RootParamList` is
 * declared anywhere in this app, so `ParamListBase`'s index signature
 * accepts any route name here; there is no typed alternative to reach
 * for. Neither destination is dictated by an approved prototype for
 * THIS screen (there isn't one for either gesture yet) — flagged in
 * this slice's HANDOFF for review, same as `AccountsScreen`'s own
 * Transfer/Archived-accounts links were.
 */
const ResumenScreen = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProp<SiblingTabParamList>>();
  const {
    status,
    errorMessage,
    reload,
    netWorth,
    cashFlowMonths,
    recentFinances,
    isRefreshing,
    refresh,
  } = useResumenScreen();

  const currentMonth = getCurrentMonthCashFlow(cashFlowMonths);
  const hasAnyActivity = cashFlowMonths.length > 0 || recentFinances.length > 0;

  const renderMovements = () => {
    if (recentFinances.length === 0) {
      return (
        <View style={styles.movementsEmpty}>
          <Text color={colors[gray][0]} align="center" style={styles.movementsEmptyText}>
            {t('resumen.movementsEmptyState')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('resumen.addFirstMovement')}
            onPress={() => navigation.navigate('Outcomes')}
            style={styles.ctaButton}>
            <Text color={colors[white][0]} bold>
              {t('resumen.addMovement')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TransactCard
        transactions={mapFinancesToTransactItems(recentFinances)}
        onPressSeeAll={() => navigation.navigate('Accounts')}
      />
    );
  };

  return (
    <ScreenTemplate
      headerTitle={t('resumen.title')}
      headerSubtitle={t('resumen.subtitle')}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          colors={[colors[accent][2]]}
        />
      }>
      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('resumen.loadingDashboard')}
          />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <Text color={colors[secondary][0]} align="center" style={styles.message}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('resumen.retryLoadingDashboard')}
            onPress={reload}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && (
        <>
          <BalanceCard
            availableCents={netWorth}
            incomeCents={currentMonth.income}
            expenseCents={currentMonth.expense}
            savingsCents={currentMonth.savings}
          />

          <CashFlowChart months={cashFlowMonths} />

          <View style={styles.movementsSection}>{renderMovements()}</View>

          {!hasAnyActivity && (
            <Text
              color={colors[gray][0]}
              align="center"
              size={12}
              style={styles.freshInstallHint}
              accessible
              accessibilityRole="text">
              {t('resumen.freshInstallHint')}
            </Text>
          )}
        </>
      )}
    </ScreenTemplate>
  );
};

const styles = StyleSheet.create({
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  message: {
    paddingHorizontal: 20,
    marginTop: 8,
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
  movementsSection: {
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
  },
  movementsEmpty: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  movementsEmptyText: {
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  ctaButton: {
    height: 44,
    minWidth: 180,
    borderRadius: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary[0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  freshInstallHint: {
    marginBottom: 10,
  },
});

export default ResumenScreen;
