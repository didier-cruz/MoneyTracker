import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {gray, colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {IChartSector} from '@components/organisms/Charts/DonutChart';
import {useTranslation} from 'react-i18next';

export interface LegendProps {
  /** Same array `DonutChart` drew its arcs from (`buildDonutData(...)
   * .sectors`) — see that function's doc for why the `percentage`
   * shown here is guaranteed to sum to 100 across the whole list and
   * correspond to what was actually drawn. */
  sectors: IChartSector[];
}

/**
 * The pie's legend, to the chart's right per the approved prototype: a
 * small color chip (11px, 3px radius), the envelope's name (13px,
 * semibold), and "amount · percentage" (12px, gray) below it. A plain
 * `.map()` over a `View` (not a `FlatList`) — this is a handful of
 * envelope rows (a user's fund/debt count, not a scrollable dataset),
 * the same call `CashFlowChart`'s own month-legend already makes.
 */
export const Legend: FC<LegendProps> = ({sectors}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      {sectors.map(sector => (
        <View
          key={sector.id}
          style={styles.row}
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('analysis.chartSectorAccessibilityLabel', {
            label: sector.label,
            amount: formatCentsToCurrency(sector.value),
            percentage: sector.percentage,
          })}>
          <View style={[styles.chip, {backgroundColor: sector.color}]} />
          <View style={styles.textColumn}>
            <Text size={13} fontWeight="600" lines={1}>
              {sector.label}
            </Text>
            <Text color={colors[gray][0]} size={12}>
              {formatCentsToCurrency(sector.value)} · {sector.percentage}%
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginLeft: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  chip: {
    width: 11,
    height: 11,
    borderRadius: 3,
    marginTop: 3,
    marginRight: 8,
  },
  textColumn: {
    flex: 1,
  },
});

export default Legend;
