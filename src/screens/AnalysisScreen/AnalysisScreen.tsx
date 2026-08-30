import {RefreshControl} from 'react-native';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {accent, colors} from '@constants/colors/colors';
import {useAnalysisScreen} from '@hooks/useAnalysisScreen';
import {buildDebtsInsight, buildFundsInsight, toDebtSectorInputs, toFundSectorInputs} from './mappers';
import {AnalysisPieCard} from './partials/AnalysisPieCard/AnalysisPieCard';
import {useTranslation} from 'react-i18next';

/**
 * Just the one sibling tab this screen navigates to — same pattern (and
 * same reasoning) as `ResumenScreen`'s own `SiblingTabParamList`: this
 * app's bottom-tab navigator has no `ParamList` generic anywhere to
 * import a typed alternative from, so this local, minimal type is at
 * least checked against this ONE literal route name rather than an
 * uncast `any`.
 */
type SiblingTabParamList = {
  Budgets: undefined;
};

/**
 * "Analysis" (Analítica) — the two donut cards from the approved
 * prototype, Debts and Funds, each independently loaded/erred/emptied
 * (same "two unrelated questions, two independent load states" split
 * `useBudgetsScreen` already established). See
 * `useAnalysisScreen`/`AnalysisScreen/mappers.ts` for where the actual
 * numbers and copy come from; this component is pure wiring + the
 * empty-state copy, which depends on WHY a card is empty (no envelope
 * of that kind at all vs envelopes that all currently net to `<= 0`) —
 * see `AnalysisPieCard`'s own doc for why that distinction lives here,
 * not inside the reusable card.
 *
 * Every "create/manage" CTA (empty-state buttons) hops to the `Budgets`
 * tab, where envelope creation/assignment/withdrawal actually lives —
 * this screen has no envelope-mutating UI of its own, matching the
 * task's read-only "ver un gráfico" framing for all three Analítica
 * user stories.
 */
const AnalysisScreen = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProp<SiblingTabParamList>>();
  const goToBudgets = () => navigation.navigate('Budgets');

  const {
    debtEnvelopes,
    debtsStatus,
    debtsErrorMessage,
    reloadDebts,

    fundEnvelopes,
    fundsStatus,
    fundsErrorMessage,
    reloadFunds,
    lastFundWithdrawal,

    isRefreshing,
    refresh,
  } = useAnalysisScreen();

  const debtSectors = toDebtSectorInputs(debtEnvelopes);
  const fundSectors = toFundSectorInputs(fundEnvelopes);

  const debtsTotal = debtSectors.reduce((sum, sector) => sum + sector.value, 0);

  return (
    <ScreenTemplate
      headerTitle={t('analysis.title')}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          colors={[colors[accent][2]]}
        />
      }>
      <AnalysisPieCard
        title={t('analysis.debtsTitle')}
        status={debtsStatus}
        errorMessage={debtsErrorMessage}
        onRetry={reloadDebts}
        centerLabel={t('analysis.totalOwed')}
        sectorInputs={debtSectors}
        insightText={debtSectors.length > 0 ? buildDebtsInsight(debtSectors, debtsTotal) : null}
        empty={{
          message:
            debtEnvelopes.length === 0
              ? t('analysis.noDebtEnvelopes')
              : t('analysis.allDebtsPaidOff'),
          ctaLabel: debtEnvelopes.length === 0 ? t('analysis.createDebtEnvelope') : t('analysis.manageEnvelopes'),
          onPressCta: goToBudgets,
        }}
      />

      <AnalysisPieCard
        title={t('analysis.fundsTitle')}
        status={fundsStatus}
        errorMessage={fundsErrorMessage}
        onRetry={reloadFunds}
        centerLabel={t('analysis.totalSaved')}
        sectorInputs={fundSectors}
        insightText={fundEnvelopes.length > 0 ? buildFundsInsight(lastFundWithdrawal) : null}
        empty={{
          message:
            fundEnvelopes.length === 0
              ? t('analysis.noFundEnvelopes')
              : t('analysis.fundsHaveNoMoney'),
          ctaLabel: fundEnvelopes.length === 0 ? t('analysis.createFundEnvelope') : t('analysis.manageEnvelopes'),
          onPressCta: goToBudgets,
        }}
      />
    </ScreenTemplate>
  );
};

export default AnalysisScreen;
