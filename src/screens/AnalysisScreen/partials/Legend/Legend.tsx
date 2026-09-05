import {FC} from 'react';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {Money} from '@components/atoms/text/Money';
import {StyleSheet, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {gray, colors, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {IChartSector} from '@components/organisms/Charts/DonutChart';
import {useTranslation} from 'react-i18next';
import {ISectorCoverage} from '../../mappers';

export interface LegendProps {
  /** Same array `DonutChart` drew its arcs from (`buildDonutData(...)
   * .sectors`) — see that function's doc for why the `percentage`
   * shown here is guaranteed to sum to 100 across the whole list and
   * correspond to what was actually drawn. */
  sectors: IChartSector[];
  /**
   * OPTIONAL second dimension, keyed by sector id — currently only the
   * Debts card passes it (see `toDebtCoverageById`). When a sector has
   * an entry, its row grows a progress bar plus an "X apartado · N%"
   * line; when it does not, the row renders exactly as before. The
   * Funds card deliberately passes nothing: on a fund envelope the
   * slice value IS what is apartado, so a coverage bar there would
   * just be a bar at 100% on every row.
   */
  coverageById?: Record<number, ISectorCoverage>;
  /**
   * Nombre de icono FontAwesome por id de sector. Cuando un sector
   * tiene entrada, su marca de color pasa de un punto de 11px a un
   * cuadrito de 22px con el icono en blanco encima — el color sigue
   * viviendo en el fondo del chip, que es lo que ata la fila a su arco.
   *
   * Es opcional y no requerido porque `Legend` no puede garantizar que
   * un sector tenga icono: "Otros" del dónut de gastos es un agregado
   * sin fila propia en `categories`, y el punto es el respaldo correcto
   * para cualquier sector futuro que tampoco lo tenga.
   */
  iconById?: Record<number, string>;
}

/**
 * The pie's legend, to the chart's right per the approved prototype:
 * the sector's color mark, the item's name (13px, semibold), and
 * "amount · percentage" (12px, gray) below it. La marca de color es un
 * cuadrito de 22px con el icono de la entidad cuando `iconById` lo
 * trae, y el punto de 11px del prototipo cuando no. A plain
 * `.map()` over a `View` (not a `FlatList`) — this is a handful of
 * envelope rows (a user's fund/debt count, not a scrollable dataset),
 * the same call `CashFlowChart`'s own month-legend already makes.
 *
 * A row carrying `coverageById` gains two things below that: a 4px
 * track filled to `coveredPct` IN THE SECTOR'S OWN COLOR (so the bar
 * is unambiguously about that slice, no second palette to reconcile),
 * and the apartado amount. The bar is `overflow: 'hidden'` on a
 * rounded track rather than a rounded fill, so a 2% fill still reads
 * as a sliver instead of collapsing into a dot.
 */
export const Legend: FC<LegendProps> = ({sectors, coverageById, iconById}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      {sectors.map(sector => {
        const coverage = coverageById?.[sector.id];
        const icon = iconById?.[sector.id];
        return (
          <View
            key={sector.id}
            style={styles.row}
            accessible
            accessibilityRole="text"
            accessibilityLabel={
              coverage
                ? t('analysis.chartSectorWithCoverageAccessibilityLabel', {
                    label: sector.label,
                    amount: formatCentsToCurrency(sector.value),
                    percentage: sector.percentage,
                    setAside: formatCentsToCurrency(coverage.setAside),
                    covered: coverage.coveredPct,
                  })
                : t('analysis.chartSectorAccessibilityLabel', {
                    label: sector.label,
                    amount: formatCentsToCurrency(sector.value),
                    percentage: sector.percentage,
                  })
            }>
            {icon !== undefined ? (
              <View style={[styles.iconChip, {backgroundColor: sector.color}]}>
                <VectorIcon name={icon} color={colors[white][0]} size={12} />
              </View>
            ) : (
              <View style={[styles.chip, {backgroundColor: sector.color}]} />
            )}
            <View style={styles.textColumn}>
              <Text size={13} fontWeight="600" lines={1}>
                {sector.label}
              </Text>
              <Text color={colors[gray][0]} size={12}>
                <Money cents={sector.value} fontSize={12} /> · {sector.percentage}%
              </Text>

              {coverage !== undefined && (
                <>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        {width: `${coverage.coveredPct}%`, backgroundColor: sector.color},
                      ]}
                    />
                  </View>
                  <Text color={colors[gray][0]} size={11} lines={1}>
                    {t('analysis.setAsideWithPct', {
                      amount: formatCentsToCurrency(coverage.setAside),
                      pct: coverage.coveredPct,
                    })}
                  </Text>
                </>
              )}
            </View>
          </View>
        );
      })}
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
  // 22px y no 24: la fila mide 13 (nombre) + 12 (importe) + interlineado,
  // y un chip mas alto que esas dos lineas juntas empuja la fila y
  // descuadra la leyenda contra el dónut de 146px que tiene al lado.
  iconChip: {
    width: 22,
    height: 22,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  track: {
    height: 4,
    borderRadius: 2,
    marginTop: 5,
    marginBottom: 3,
    // El mismo gris al 15% que usa el aro de fondo del donut, para que
    // la pista vacia se lea como "el resto de esta deuda" y no como un
    // elemento nuevo.
    backgroundColor: `${colors[gray][0]}26`,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

export default Legend;
