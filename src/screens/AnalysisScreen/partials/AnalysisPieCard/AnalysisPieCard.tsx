import {FC} from 'react';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {buildDonutData, DonutChart, IChartSectorInput} from '@components/organisms/Charts/DonutChart';
import {colors, gray, secondary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {LoadStatus} from '@hooks/useAnalysisScreen';
import {Legend} from '../Legend/Legend';
import {InsightStrip} from '../InsightStrip/InsightStrip';
import {ISectorCoverage} from '../../mappers';
import {useTranslation} from 'react-i18next';

/**
 * El selector de periodo de UNA tarjeta.
 *
 * Vive aqui dentro y no en la cabecera de la pantalla a proposito. En
 * Analitica conviven datos de dos naturalezas: los sobres —deudas y
 * fondos— son ACUMULADOS y ninguna de sus consultas filtra por fecha,
 * mientras que el gasto por categoria solo significa algo dentro de un
 * tramo. Una etiqueta de periodo en el header aplicaria visualmente a
 * las tres tarjetas y volveria a mentir sobre dos de ellas, que es
 * exactamente por lo que se le quito el subtitulo de mes a esta
 * pantalla (ver `AnalysisScreen`). Con el chip dentro, la unica
 * tarjeta que respeta el intervalo es la unica que lo anuncia.
 */
export interface AnalysisPieCardPeriodChip {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
}

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
  /** Opcional: cuando se pasa, la tarjeta muestra bajo su titulo un
   * chip tocable con el periodo al que corresponden sus cifras. Las
   * tarjetas de sobres no lo pasan — ver `AnalysisPieCardPeriodChip`. */
  periodChip?: AnalysisPieCardPeriodChip;
  /** Already filtered to `value > 0` and sorted biggest-first — see
   * `AnalysisScreen/mappers.ts`'s `toDebtSectorInputs`/
   * `toFundSectorInputs`. This card computes `buildDonutData` itself
   * from these, so the arcs it draws and the legend/percentages it
   * shows can never independently drift apart (single source of
   * truth, see `donutMath.ts`). */
  sectorInputs: IChartSectorInput[];
  /** Per-sector "already covered" annotation, passed straight to
   * `Legend` — only the Debts card supplies it, see
   * `mappers.ts`'s `toDebtCoverageById` for what it means and why the
   * ring is NOT re-sized by it. */
  coverageById?: Record<number, ISectorCoverage>;
  /** Iconos para la leyenda, keyed by sector id — ver `Legend`. */
  iconById?: Record<number, string>;
  /**
   * Optional caption UNDER the donut — the Debts card's total "X
   * apartado".
   *
   * Deliberately outside the ring: it was first tried as a third line
   * inside the donut's center and verified on-device (Android
   * emulator, 2026-09-03) to overflow — the center box is bounded to
   * `holeDiameter` (146 - 2*22 = 102px) and `"$1,400.00 apartado"`
   * rendered straight over the arc on both sides. `adjustsFontSizeToFit`
   * could only fix it by shrinking the text past legibility.
   */
  chartCaption?: string;
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
  periodChip,
  sectorInputs,
  coverageById,
  iconById,
  chartCaption,
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
      <Title level={2} style={periodChip === undefined ? styles.title : styles.titleWithChip}>
        {title}
      </Title>

      {periodChip !== undefined && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={periodChip.accessibilityLabel}
          onPress={periodChip.onPress}
          style={styles.periodChip}>
          <Text size={13} color={colors[gray][1]}>
            {periodChip.label}
          </Text>
          <VectorIcon name="chevron-down" color={colors[gray][0]} size={10} />
        </TouchableOpacity>
      )}

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
              <View style={styles.chartColumn}>
                <DonutChart
                  sectors={sectors}
                  centerLabel={centerLabel}
                  centerValue={formatCentsToCurrency(total)}
                  accessibilityLabel={chartAccessibilityLabel}
                />
                {chartCaption !== undefined && (
                  <Text color={colors[gray][0]} size={12} align="center" style={styles.caption}>
                    {chartCaption}
                  </Text>
                )}
              </View>
              <Legend sectors={sectors} coverageById={coverageById} iconById={iconById} />
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
    // `boxShadow` y no `elevation`: en Android la sombra de `elevation`
    // sigue el contorno RECTANGULAR de la vista y asomaba por las
    // esquinas de las tarjetas redondeadas como un cuadrado gris.
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.10)',
  },
  title: {
    marginBottom: 16,
  },
  titleWithChip: {
    marginBottom: 10,
  },
  // `alignSelf: 'flex-start'` para que el chip mida lo que mide su
  // texto: sin el, la fila se estira a todo el ancho de la tarjeta y el
  // area tocable llega hasta el borde derecho, muy lejos de lo que se
  // ve como boton.
  periodChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.inactive[0],
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartColumn: {
    alignItems: 'center',
  },
  caption: {
    marginTop: 8,
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
