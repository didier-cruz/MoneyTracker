import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import {Title, Text} from '@redshank/native';
import {BarChart} from 'react-native-gifted-charts';
import type {barDataItem} from 'react-native-gifted-charts';
import {ICashFlowMonth} from '@db/queries';
import {colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {widthDP} from '@utils/responsive';
import {getMonthAbbreviation} from '@screens/ResumenScreen/mappers';
import {useTranslation} from 'react-i18next';
import i18n from '@i18n';

export interface CashFlowChartProps {
  /** Ascending (`month.month` ASC) — `getCashFlowByMonth`'s own
   * contract. 0 TO 6 items: a month with no qualifying activity simply
   * isn't in the array (see that query's doc comment), so a brand-new
   * install legitimately passes `[]`, and an install a single month old
   * legitimately passes exactly one. Neither is padded up to 6 by this
   * component OR its caller — see `renderEmptyState`/the single-group
   * case below for why that's fine to render as-is. */
  months: ICashFlowMonth[];
}

/** Fixed brand tokens for the three series — same "lima ingresos, rojo
 * gastos, ámbar ahorros" mapping the balance card's mini-stats use
 * (`colors.accent[1]`/`colors.error[0]`/`colors.warning[0]`). */
const SERIES_COLORS = {
  income: colors.accent[1],
  expense: colors.error[0],
  savings: colors.warning[0],
};

const CHART_HEIGHT = 170;
const INNER_BAR_SPACING = 3;
const EDGE_SPACING = 14;
const MIN_GROUP_GAP = 12;

/** Screen padding (`ScreenContainer`, 15 each side) + this card's own
 * horizontal padding (20 each side) — subtracted from full device width
 * to get the chart's actual available drawing width, so the grouped
 * bars always fill the card regardless of how many months (1-6) are
 * being plotted, instead of a fixed pixel width that would look sparse
 * with few months or overflow with many. */
const HORIZONTAL_CHROME = 15 * 2 + 20 * 2;

/** Narrower bars as more months compete for the same width — three
 * bars per month, so this matters a lot more here than in a typical
 * single-series bar chart. */
const barWidthForGroupCount = (groupCount: number): number => {
  if (groupCount <= 2) {
    return 18;
  }
  if (groupCount <= 4) {
    return 13;
  }
  return 9;
};

const buildBarData = (
  months: ICashFlowMonth[],
  barWidth: number,
  groupGap: number,
): barDataItem[] => {
  const bars: barDataItem[] = [];

  months.forEach((month, index) => {
    const isLastGroup = index === months.length - 1;

    bars.push({
      value: month.income,
      frontColor: SERIES_COLORS.income,
      spacing: INNER_BAR_SPACING,
    });
    bars.push({
      value: month.expense,
      frontColor: SERIES_COLORS.expense,
      spacing: INNER_BAR_SPACING,
    });
    bars.push({
      // `savings` is SIGNED (see `ICashFlowMonth.savings`'s doc) — a
      // net fund withdrawal for the month renders as a bar below the
      // axis (`noOfSectionsBelowXAxis`/`mostNegativeValue` below), not
      // clamped to 0, which would silently hide a real withdrawal.
      value: month.savings,
      frontColor: SERIES_COLORS.savings,
      spacing: isLastGroup ? 0 : groupGap,
    });
  });

  return bars;
};

/**
 * The month labels, laid out as this component's OWN flex row directly
 * below the `BarChart` — NOT the bars' own built-in per-item `label`.
 * `barDataItem.labelsDistanceFromXaxis`/the chart-level
 * `xAxisLabelsAtBottom` (the library's documented way to push a label
 * clear of a below-axis negative bar) were both verified on-device
 * (Android emulator) to have NO effect on this version's plain
 * (non-stacked) bar renderer — a label still draws right at the axis
 * line regardless, overlapping the top of any negative `savings` bar's
 * dip. Rendering the labels as a separate row, sized with the exact
 * same `EDGE_SPACING`/`groupWidth`/`groupGap` math the bars themselves
 * use, reproduces the same per-group centering without depending on
 * that (non-functional, for this case) library feature at all.
 */
const MonthLabelsRow: FC<{months: ICashFlowMonth[]; groupWidth: number; groupGap: number}> = ({
  months,
  groupWidth,
  groupGap,
}) => (
  <View style={[styles.labelsRow, {paddingHorizontal: EDGE_SPACING}]}>
    {months.map((month, index) => (
      // A fixed-width, `alignItems: 'center'` `View` wrapper — not
      // `Text`'s own `width` + `align="center"` styling directly, which
      // was verified on-device to NOT actually center the glyphs within
      // that width (the rendered text sat left-shifted inside its box);
      // a plain flexbox-centered wrapper is the reliable way to center
      // one fixed-width item regardless of that.
      <View
        key={month.month}
        style={{
          width: groupWidth,
          marginRight: index === months.length - 1 ? 0 : groupGap,
          alignItems: 'center',
        }}>
        <Text color={colors.gray[0]} size={11}>
          {getMonthAbbreviation(month.month)}
        </Text>
      </View>
    ))}
  </View>
);

/**
 * The bar chart itself is a decorative SVG to a screen reader — a
 * TalkBack/VoiceOver user gets nothing from it otherwise, and this
 * trend (up to 6 months) isn't spelled out as text anywhere else on
 * `ResumenScreen` (unlike this month's own figures, already read aloud
 * by `BalanceCard`'s mini-stats). One combined summary, oldest month
 * first, gives that same information a sighted user gets by scanning
 * the bars left to right.
 */
const buildChartAccessibilityLabel = (months: ICashFlowMonth[]): string =>
  i18n.t('resumen.cashFlowAccessibilityLabel', {
    count: months.length,
    breakdown: months
      .map(month =>
        i18n.t('resumen.cashFlowMonthAccessibilityLabel', {
          month: getMonthAbbreviation(month.month),
          income: formatCentsToCurrency(month.income),
          expense: formatCentsToCurrency(month.expense),
          savings: formatCentsToCurrency(month.savings),
        }),
      )
      .join('. '),
  });

const LegendDot: FC<{color: string; label: string}> = ({color, label}) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, {backgroundColor: color}]} />
    <Text color={colors.gray[0]} size={11}>
      {label}
    </Text>
  </View>
);

/**
 * The cash-flow card from the approved prototype: title + "Last 6
 * months" + a 3-color legend + a grouped bar chart (income/expense/
 * savings per month), faint horizontal guide lines, month labels, no
 * y-axis numbers (the prototype shows guide lines only, never plotted
 * values on the axis itself).
 *
 * Renders a guiding empty state instead of an empty/broken chart when
 * `months` is `[]` (a brand-new install, or simply no activity in the
 * lookback window) — see this screen's task note: "no dejar un gráfico
 * roto ni un cero mudo". A single month renders as one group of 3 bars;
 * this component makes no assumption that exactly 6 groups exist.
 */
export const CashFlowChart: FC<CashFlowChartProps> = ({months}) => {
  const {t} = useTranslation();
  const isEmpty = months.length === 0;
  const chartWidth = widthDP(100) - HORIZONTAL_CHROME;

  const barWidth = barWidthForGroupCount(Math.max(months.length, 1));
  const groupWidth = barWidth * 3 + INNER_BAR_SPACING * 2;
  const totalGroupsWidth = groupWidth * months.length;
  const availableForGaps = chartWidth - totalGroupsWidth - EDGE_SPACING * 2;
  const groupGap =
    months.length > 1
      ? Math.max(availableForGaps / (months.length - 1), MIN_GROUP_GAP)
      : 0;

  const hasNegativeSavings = months.some(month => month.savings < 0);
  // A SHARED positive/negative scale, derived from the largest
  // magnitude across EVERY bar (income, expense, and `Math.abs(savings)`
  // for a negative month) — gifted-charts computes the above-axis and
  // below-axis scales INDEPENDENTLY by default when
  // `noOfSectionsBelowXAxis` is used, which would size a small negative
  // `savings` bar's one section as tall as a much larger positive bar's
  // several sections, making the two axes visually incomparable (e.g. a
  // -$30 dip would render no smaller than a +$2,000 income bar). Pinning
  // both `maxValue`/`mostNegativeValue` AND `stepValue`/
  // `negativeStepValue` to the same magnitude keeps one dollar the same
  // bar height everywhere on the chart, above or below the axis.
  const maxMagnitude = Math.max(
    1,
    ...months.flatMap(month => [month.income, month.expense, Math.abs(month.savings)]),
  );
  const NO_OF_SECTIONS = 4;
  const stepValue = maxMagnitude / NO_OF_SECTIONS;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Title level={3} style={styles.title}>
          {t('resumen.cashFlow')}
        </Title>
        <Text color={colors.gray[0]} size={12}>
          {t('resumen.last6Months')}
        </Text>
      </View>

      <View style={styles.legendRow}>
        <LegendDot color={SERIES_COLORS.income} label={t('resumen.income')} />
        <LegendDot color={SERIES_COLORS.expense} label={t('resumen.expense')} />
        <LegendDot color={SERIES_COLORS.savings} label={t('resumen.savings')} />
      </View>

      {isEmpty ? (
        <View
          style={styles.emptyState}
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('resumen.cashFlowEmptyAccessibilityLabel')}>
          <Text color={colors.gray[0]} align="center">
            {t('resumen.cashFlowEmptyState')}
          </Text>
        </View>
      ) : (
        <View accessible accessibilityRole="image" accessibilityLabel={buildChartAccessibilityLabel(months)}>
          <BarChart
            data={buildBarData(months, barWidth, groupGap)}
            width={chartWidth}
            height={CHART_HEIGHT}
            barWidth={barWidth}
            initialSpacing={EDGE_SPACING}
            endSpacing={EDGE_SPACING}
            disableScroll
            isAnimated
            hideYAxisText
            yAxisLabelWidth={0}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={colors.inactive[0]}
            rulesColor={colors.inactive[0]}
            rulesThickness={1}
            maxValue={maxMagnitude}
            stepValue={stepValue}
            noOfSections={NO_OF_SECTIONS}
            noOfSectionsBelowXAxis={hasNegativeSavings ? 1 : 0}
            negativeStepValue={hasNegativeSavings ? stepValue : undefined}
            mostNegativeValue={hasNegativeSavings ? -maxMagnitude : undefined}
          />
          <MonthLabelsRow months={months} groupWidth={groupWidth} groupGap={groupGap} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface[0],
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    marginBottom: 0,
  },
  legendRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  emptyState: {
    minHeight: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
});

export default CashFlowChart;
