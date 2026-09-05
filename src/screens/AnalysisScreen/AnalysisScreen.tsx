import {useState} from 'react';
import {RefreshControl} from 'react-native';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {accent, colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useAnalysisScreen} from '@hooks/useAnalysisScreen';
import {
  buildDebtsInsight,
  buildExpenseInsight,
  buildFundsInsight,
  sumDebtSetAside,
  toDebtCoverageById,
  toDebtSectorInputs,
  toEnvelopeIconById,
  toExpenseChartData,
  toFundSectorInputs,
} from './mappers';
import {AnalysisPieCard} from './partials/AnalysisPieCard/AnalysisPieCard';
import {PeriodPickerSheet} from '@components/organisms/pickers';
import {buildDonutData} from '@components/organisms/Charts/DonutChart';
import {usePeriod} from '@context/PeriodContext';
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
 * "Analysis" (Analítica) — tres tarjetas de dónut, cada una con su
 * propio ciclo de carga/error/vacio (el mismo reparto de "preguntas
 * independientes, estados independientes" que ya establecio
 * `useBudgetsScreen`).
 *
 * El ORDEN es una decision de producto, no el de implementacion: "En
 * que gastas" va primero aunque sea la ultima que se construyo. Es la
 * unica que responde a donde se fue el dinero —la pregunta con la que
 * se entra a esta pantalla— y la unica accionable a corto plazo;
 * deudas y fondos son saldos acumulados que se mueven despacio y
 * aguantan perfectamente estar por debajo. Las otras dos siguen en el
 * orden del prototipo aprobado, Deudas y luego Fondos. See
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

  const {selection, setSelection, resolved} = usePeriod();
  const [isPeriodSheetOpen, setPeriodSheetOpen] = useState(false);

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

    spendingByCategory,
    expensesStatus,
    expensesErrorMessage,
    reloadExpenses,

    isRefreshing,
    refresh,
  } = useAnalysisScreen();

  const debtSectors = toDebtSectorInputs(debtEnvelopes);
  const fundSectors = toFundSectorInputs(fundEnvelopes);

  const debtsTotal = debtSectors.reduce((sum, sector) => sum + sector.value, 0);
  // The Debts card's second dimension: what is already apartado toward
  // each debt. Sized separately from the ring on purpose — see
  // `toDebtCoverageById`'s doc for why re-sizing the ring by `balance`
  // was rejected.
  const debtCoverage = toDebtCoverageById(debtEnvelopes);
  const debtsSetAside = sumDebtSetAside(debtEnvelopes);

  const {sectors: expenseSectors, iconById: expenseIcons} = toExpenseChartData(spendingByCategory);
  // Los porcentajes de la frase salen de `buildDonutData`, la MISMA
  // funcion que dibuja los arcos, para que la tira lima no pueda decir
  // un numero distinto al de la leyenda — ver `donutMath.ts`.
  const expenseInsight = buildExpenseInsight(buildDonutData(expenseSectors).sectors);

  return (
    <ScreenTemplate
      // Sin subtitulo de mes, a proposito. Esta pantalla decia
      // "Septiembre" pero sus datos NO son mensuales:
      // `useAnalysisScreen` consulta sobres —deudas y fondos—, que son
      // acumulados, y ni una sola de sus consultas filtra por periodo.
      // El mes era decoracion, y una que mentia: se leia "Septiembre"
      // sobre cifras de todo el historico. Antes que conectarla al
      // periodo global —lo que cambiaria lo que la pantalla significa—
      // se quita la etiqueta que no era cierta.
      headerTitle={t('analysis.title')}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          colors={[colors[accent][2]]}
        />
      }>
      <AnalysisPieCard
        title={t('analysis.expensesTitle')}
        status={expensesStatus}
        errorMessage={expensesErrorMessage}
        onRetry={reloadExpenses}
        centerLabel={t('analysis.totalSpent')}
        periodChip={{
          label: resolved.label,
          onPress: () => setPeriodSheetOpen(true),
          accessibilityLabel: t('analysis.changeExpensesPeriod', {period: resolved.label}),
        }}
        sectorInputs={expenseSectors}
        iconById={expenseIcons}
        insightText={expenseInsight}
        empty={{
          message: t('analysis.noExpensesInPeriod', {period: resolved.label}),
          // Manda al selector, no a crear un movimiento: si el tramo
          // elegido ya paso, "registra un gasto" no es algo que el
          // usuario pueda hacer para llenar ESTA tarjeta.
          ctaLabel: t('analysis.chooseAnotherPeriod'),
          onPressCta: () => setPeriodSheetOpen(true),
        }}
      />

      <AnalysisPieCard
        title={t('analysis.debtsTitle')}
        status={debtsStatus}
        errorMessage={debtsErrorMessage}
        onRetry={reloadDebts}
        centerLabel={t('analysis.totalOwed')}
        sectorInputs={debtSectors}
        coverageById={debtCoverage}
        iconById={toEnvelopeIconById(debtEnvelopes)}
        chartCaption={
          debtsSetAside > 0
            ? t('analysis.setAsideShort', {amount: formatCentsToCurrency(debtsSetAside)})
            : undefined
        }
        insightText={
          debtSectors.length > 0
            ? buildDebtsInsight(debtSectors, debtsTotal, debtsSetAside)
            : null
        }
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
        iconById={toEnvelopeIconById(fundEnvelopes)}
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

      <PeriodPickerSheet
        visible={isPeriodSheetOpen}
        onClose={() => setPeriodSheetOpen(false)}
        selection={selection}
        onChange={setSelection}
      />
    </ScreenTemplate>
  );
};

export default AnalysisScreen;
