import {FC} from 'react';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Money} from '@components/atoms/text/Money';
import {accent, colors, gray, primary, white} from '@constants/colors/colors';
import {formatMonthName} from '@utils/dateFormat';
import {IRolloverSuggestion} from '@screens/AchievementsScreen/monthlyOutcomes';
import {useTranslation} from 'react-i18next';

export interface RolloverCardProps {
  suggestions: IRolloverSuggestion[];
  /** El mes en curso, `'YYYY-MM'`, para nombrarlo en el texto. */
  targetPeriod: string;
  onApply: () => void;
  onDismiss: () => void;
  onPressAdjust: () => void;
  isApplying: boolean;
}

/**
 * "Este mes empieza sin limites. ¿Te llevo los del mes pasado?"
 *
 * Existe porque los limites NO se arrastran solos —`setCategoryBudget`
 * escribe un par `(idCategory, period)` y nada los lleva al mes
 * siguiente—, asi que cada dia 1 la seccion amanecia vacia y habia que
 * recrearlos a mano. Ese trabajo manual es exactamente por lo que un
 * presupuesto mensual se abandona al tercer mes.
 *
 * Y es el sitio donde las dos mitades de la funcion se juntan: el
 * veredicto del mes que cerro decide el numero que se propone para el
 * que empieza. Un limite que se cumplio se repite; uno que se excedio
 * se sube al gasto real —repetir un limite que ya se demostro corto
 * entrena a ignorar la app— y la tarjeta lo DICE, con la flecha y el
 * importe anterior a la vista. Nada cambia a escondidas.
 */
export const RolloverCard: FC<RolloverCardProps> = ({
  suggestions,
  targetPeriod,
  onApply,
  onDismiss,
  onPressAdjust,
  isApplying,
}) => {
  const {t} = useTranslation();
  const [first] = suggestions;
  if (first === undefined) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.icon}>
          <VectorIcon name="calendar-o" color={colors[primary][0]} size={14} />
        </View>
        <Text size={14} bold style={styles.heading}>
          {t('budgets.rolloverTitle', {month: formatMonthName(targetPeriod)})}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('budgets.rolloverDismiss')}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          onPress={onDismiss}>
          <VectorIcon name="times" color={colors[gray][0]} size={14} />
        </TouchableOpacity>
      </View>

      <Text color={colors[gray][0]} size={12} style={styles.intro}>
        {t('budgets.rolloverIntro', {month: formatMonthName(first.fromPeriod)})}
      </Text>

      {suggestions.map(suggestion => (
        <View key={suggestion.idCategory} style={styles.row}>
          <Text size={13} lines={1} style={styles.rowName}>
            {suggestion.category.name}
          </Text>
          <Text size={13} bold>
            <Money cents={suggestion.suggestedAmount} fontSize={13} />
          </Text>
          <Text
            color={suggestion.basedOn === 'exceeded' ? colors.warning[0] : colors[accent][3]}
            size={11}
            lines={1}
            style={styles.rowNote}>
            {suggestion.basedOn === 'exceeded'
              ? t('budgets.rolloverRaisedFrom', {
                  amount: formatAmountShort(suggestion.previousAmount),
                })
              : t('budgets.rolloverKept')}
          </Text>
        </View>
      ))}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('budgets.rolloverApply')}
        accessibilityState={{disabled: isApplying}}
        disabled={isApplying}
        onPress={onApply}
        style={styles.applyButton}>
        {isApplying ? (
          <ActivityIndicator color={colors[white][0]} />
        ) : (
          <Text color={colors[white][0]} bold>
            {t('budgets.rolloverApply')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('budgets.rolloverAdjust')}
        onPress={onPressAdjust}
        style={styles.adjustButton}>
        <Text color={colors[gray][0]} size={13}>
          {t('budgets.rolloverAdjust')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/** Solo para la coletilla "de $500": los centavos ahi son ruido y
 * `Money` no cabe dentro de una cadena traducida. */
const formatAmountShort = (cents: number): string =>
  `$${Math.round(cents / 100).toLocaleString('en-US')}`;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors[white][0],
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.10)',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.inactive[0],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heading: {
    flex: 1,
    marginRight: 8,
  },
  intro: {
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 8,
  },
  rowName: {
    flex: 1,
  },
  // Ancho fijo y a la derecha del importe: sin el, una coletilla larga
  // ("subido de $500") empuja el importe y las filas dejan de alinearse
  // entre si.
  rowNote: {
    width: 92,
    textAlign: 'right',
  },
  applyButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors[primary][0],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  adjustButton: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});

export default RolloverCard;
