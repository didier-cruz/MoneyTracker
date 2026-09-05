import {FC, useState} from 'react';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {LayoutAnimation, Platform, StyleSheet, TouchableOpacity, UIManager, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Money} from '@components/atoms/text/Money';
import {accent, colors, gray, primary, white} from '@constants/colors/colors';
import {formatMonthYearLong} from '@utils/dateFormat';
import {IMonthOutcome} from '../../monthlyOutcomes';
import {useTranslation} from 'react-i18next';

// `LayoutAnimation` esta detras de un flag en Android y sin esto el
// desplegable salta de golpe. Mismo arranque que recomienda la propia
// documentacion de React Native; en iOS no hace falta.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface MonthOutcomeCardProps {
  outcome: IMonthOutcome;
}

/**
 * Un mes cerrado: cuantos limites se cumplieron, cuanto sobro, y en que
 * categorias se gasto menos que antes.
 *
 * **Una tarjeta por MES, no por categoria.** Con seis limites, un ano de
 * uso son 72 filas que sepultarian los logros de sobres en la misma
 * pantalla. El detalle por categoria existe, pero desplegado: la lista
 * se recorre por meses y se entra solo al que interesa.
 *
 * El color lo decide si el mes salio limpio (ningun limite excedido) o
 * no. Un mes con excesos NO se pinta de rojo: es ambar. El rojo en esta
 * app significa deuda y saldo negativo, y ademas un mes que se paso en
 * una categoria de seis sigue siendo un mes con cinco cumplidas — la
 * pantalla se llama Logros, no Faltas.
 */
export const MonthOutcomeCard: FC<MonthOutcomeCardProps> = ({outcome}) => {
  const {t} = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isClean = outcome.exceededCount === 0;
  const tint = isClean ? colors[accent][2] : colors.warning[0];
  const hasDetail = outcome.limits.length > 0 || outcome.improvements.length > 0;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(previous => !previous);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, {backgroundColor: tint}]} />

      <View style={styles.body}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{expanded}}
          accessibilityLabel={t('achievements.monthCardAccessibilityLabel', {
            month: formatMonthYearLong(outcome.period),
          })}
          disabled={!hasDetail}
          onPress={toggle}
          style={styles.header}>
          <View style={[styles.icon, {backgroundColor: tint}]}>
            <VectorIcon name="calendar" color={colors[white][0]} size={15} />
          </View>

          <View style={styles.headline}>
            <Text size={14} bold lines={1}>
              {formatMonthYearLong(outcome.period)}
            </Text>
            <Text color={colors[gray][0]} size={12} lines={2}>
              {outcome.limits.length > 0
                ? t('achievements.limitsMet', {
                    met: outcome.metCount,
                    total: outcome.metCount + outcome.exceededCount,
                  })
                : t('achievements.noLimitsThatMonth')}
            </Text>
          </View>

          {hasDetail && (
            <VectorIcon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={colors[gray][0]}
            />
          )}
        </TouchableOpacity>

        {outcome.underBy > 0 && (
          <Text color={colors[accent][3]} size={13} style={styles.underBy}>
            {t('achievements.underBudgetBy')} <Money cents={outcome.underBy} fontSize={13} />
          </Text>
        )}

        {expanded && (
          <View style={styles.detail}>
            {outcome.limits.map(limit => (
              <View key={limit.category.id} style={styles.detailRow}>
                <VectorIcon
                  name={
                    limit.verdict === 'met'
                      ? 'check'
                      : limit.verdict === 'exceeded'
                      ? 'exclamation'
                      : 'minus'
                  }
                  size={11}
                  color={
                    limit.verdict === 'met'
                      ? colors[accent][2]
                      : limit.verdict === 'exceeded'
                      ? colors.warning[0]
                      : colors[gray][0]
                  }
                  style={styles.detailIcon}
                />
                <Text size={12} lines={1} style={styles.detailName}>
                  {limit.category.name}
                </Text>
                <Text color={colors[gray][0]} size={12}>
                  {limit.verdict === 'inactive' ? (
                    t('achievements.noActivity')
                  ) : (
                    <>
                      <Money cents={limit.spent} fontSize={12} /> /{' '}
                      <Money cents={limit.limitAmount} fontSize={12} />
                    </>
                  )}
                </Text>
              </View>
            ))}

            {outcome.improvements.length > 0 && (
              <>
                <Text color={colors[gray][0]} size={11} style={styles.detailHeading}>
                  {t('achievements.spentLessHeading')}
                </Text>
                {outcome.improvements.map(improvement => (
                  <View key={improvement.category.id} style={styles.detailRow}>
                    <VectorIcon
                      name="arrow-down"
                      size={11}
                      color={colors[accent][2]}
                      style={styles.detailIcon}
                    />
                    <Text size={12} lines={1} style={styles.detailName}>
                      {improvement.category.name}
                    </Text>
                    <Text color={colors[gray][0]} size={12} lines={1}>
                      {/* "que el mes pasado" con UN mes de referencia y
                          "que tu promedio" con dos o mas: llamar promedio
                          a un solo mes seria falso. */}
                      <Money cents={improvement.savedAmount} fontSize={12} />{' '}
                      {improvement.baselineMonths === 1
                        ? t('achievements.lessThanLastMonth')
                        : t('achievements.lessThanAverage')}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors[white][0],
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.10)',
  },
  stripe: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    flex: 1,
    marginRight: 8,
  },
  underBy: {
    marginTop: 10,
  },
  detail: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.overlay[1],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  // Ancho fijo para que los nombres queden alineados aunque los iconos
  // midan distinto (un `check` es mas estrecho que un `exclamation`).
  detailIcon: {
    width: 16,
    marginRight: 8,
  },
  detailName: {
    flex: 1,
    marginRight: 8,
  },
  detailHeading: {
    marginTop: 10,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors[primary][0],
  },
});

export default MonthOutcomeCard;
