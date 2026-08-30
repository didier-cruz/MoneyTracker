import {FC} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text, Title} from '@redshank/native';
import {buildDonutData, DonutChart, IChartSectorInput} from '@components/organisms/Charts/DonutChart';
import {colors, gray, secondary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {LoadStatus} from '@hooks/useAnalysisScreen';
import {Legend} from '../Legend/Legend';
import {InsightStrip} from '../InsightStrip/InsightStrip';
import {useTranslation} from 'react-i18next';

export interface AnalysisPieCardEmptyState {
  message: string;
  ctaLabel: string;
  onPressCta: () => void;
}

export interface AnalysisPieCardProps {
  title: string;
  status: LoadStatus;
  errorMessage: string;
  onRetry: () => void;
  /** Small label above the donut's center amount, e.g. `"Total owed"` /
   * `"Total saved"`. */
  centerLabel: string;
  /** Already filtered to `value > 0` and sorted biggest-first — see
   * `AnalysisScreen/mappers.ts`'s `toDebtSectorInputs`/
   * `toFundSectorInputs`. This card computes `buildDonutData` itself
   * from these, so the arcs it draws and the legend/percentages it
   * shows can never independently drift apart (single source of
   * truth, see `donutMath.ts`). */
  sectorInputs: IChartSectorInput[];
  /**
   * `null` when there is genuinely nothing to say (no envelope of this
   * kind exists at all) — in every other case this is shown REGARDLESS
   * of whether `sectorInputs` is empty. That "regardless" matters most
   * on the Funds card: a fund emptied down to a `0` balance by a RECENT
   * withdrawal has nothing left to chart (excluded from `sectorInputs`,
   * see its own doc) — exactly the moment "cuándo lo utilizo" (this
   * slice's third user story) most wants to surface, so the usage
   * sentence must not be hidden behind "there's nothing to chart".
   */
  insightText: string | null;
  empty: AnalysisPieCardEmptyState;
}

/**
 * One Analítica card — Debts or Funds, identical layout either way per
 * the approved prototype: `Title level={2}` heading, a 146px donut on
 * the left with the total centered inside it, the legend to its right,
 * and the lime insight strip below. Owns its own
 * loading/error/empty/success lifecycle, same shape every other list-
 * backed section in this app already uses (`EnvelopesSection`,
 * `CategoryLimitsSection`).
 *
 * The empty state (`sectorInputs.length === 0`) is ONE state covering
 * TWO different underlying reasons — "no envelope of this kind exists
 * yet" and "envelopes exist but every one nets to `<= 0`" (a debt fully
 * paid off, a fund with nothing assigned) — because both read the same
 * way to the user ("there is nothing to chart right now") and both
 * want the identical fix (go create/fund one); `AnalysisScreen` is the
 * one that picks the exact wording for `empty.message` per case, this
 * card just renders whatever it's given.
 */
export const AnalysisPieCard: FC<AnalysisPieCardProps> = ({
  title,
  status,
  errorMessage,
  onRetry,
  centerLabel,
  sectorInputs,
  insightText,
  empty,
}) => {
  const {t} = useTranslation();
  // `total` here is DELIBERATELY the sum of the sectors actually drawn
  // (`buildDonutData`'s own total), NOT `useAnalysisScreen`'s
  // separately-fetched `totalRemainingDebt`/`totalFundsBalance` — see
  // this slice's HANDOFF for the one edge case where those two numbers
  // can differ (an overpaid debt / an overdrawn fund has a `<= 0`
  // derived value and is excluded from `sectorInputs` entirely, which
  // can pull the fetched aggregate below the sum of the remaining
  // positive envelopes). Deriving the center label from the SAME data
  // the ring is built from guarantees "the center number equals what
  // the slices add up to" always holds — the property this slice's
  // task was explicit about protecting.
  const {sectors, total} = buildDonutData(sectorInputs);

  const chartAccessibilityLabel = t('analysis.chartAccessibilityLabel', {
    title,
    breakdown: sectors
      .map(sector =>
        t('analysis.chartSectorAccessibilityLabel', {
          label: sector.label,
          amount: formatCentsToCurrency(sector.value),
          percentage: sector.percentage,
        }),
      )
      .join('. '),
  });

  return (
    <View style={styles.card}>
      <Title level={2} style={styles.title}>
        {title}
      </Title>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors.accent[2]}
            accessibilityLabel={t('analysis.loadingCard', {title})}
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
            accessibilityLabel={t('analysis.retryLoadingCard', {title})}
            onPress={onRetry}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && (
        <>
          {sectors.length === 0 ? (
            <View style={styles.centered}>
              <Text color={colors[gray][0]} align="center" style={styles.message}>
                {empty.message}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={empty.ctaLabel}
                onPress={empty.onPressCta}
                style={styles.ctaButton}>
                <Text color={colors[white][0]} bold>
                  {empty.ctaLabel}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.chartRow}>
              <DonutChart
                sectors={sectors}
                centerLabel={centerLabel}
                centerValue={formatCentsToCurrency(total)}
                accessibilityLabel={chartAccessibilityLabel}
              />
              <Legend sectors={sectors} />
            </View>
          )}
          {insightText !== null && <InsightStrip text={insightText} />}
        </>
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
  title: {
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  message: {
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  retryButton: {
    height: 44,
    minWidth: 120,
    borderRadius: 10,
    backgroundColor: colors[secondary][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaButton: {
    height: 44,
    minWidth: 180,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.primary[0],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AnalysisPieCard;
