import {FC} from 'react';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Money} from '@components/atoms/text/Money';
import {IEnvelopeWithBalance} from '@db/queries';
import {accent, colors, gray, primary, white} from '@constants/colors/colors';
import {formatDisplayDate} from '@utils/dateFormat';
import {buildDurationLabel, getAchievedAmount} from '../../mappers';
import {useTranslation} from 'react-i18next';

export interface AchievementCardProps {
  envelope: IEnvelopeWithBalance;
  onPressReopen: (envelope: IEnvelopeWithBalance) => void;
  disabled?: boolean;
}

/**
 * Un logro.
 *
 * Tres decisiones que no son cosmeticas:
 *
 * - **El icono es el del sobre**, no un trofeo generico. El avion que el
 *   usuario eligio para "Viaje Paris" es lo que hace que el logro sea
 *   suyo y no una plantilla.
 * - **El color distingue el tipo sin etiqueta**: lima para un fondo
 *   cumplido, indigo para una deuda saldada. Nada de rojo, aunque el
 *   resto de la app pinte las deudas de rojo — ahi el rojo significa
 *   "debes esto"; aqui la deuda esta pagada y decirlo en rojo daria
 *   justo el mensaje contrario.
 * - **La frase cambia segun el tipo**, no solo el sustantivo: se ahorra
 *   PARA algo y se salda algo. Meterlas en una sola plantilla obligaria
 *   a una redaccion neutra que no dice ninguna de las dos cosas bien.
 */
export const AchievementCard: FC<AchievementCardProps> = ({
  envelope,
  onPressReopen,
  disabled = false,
}) => {
  const {t} = useTranslation();
  const isFund = envelope.kind === 'fund';
  const tint = isFund ? colors[accent][2] : colors[primary][0];
  const amount = getAchievedAmount(envelope);
  const duration = buildDurationLabel(envelope.createdAt, envelope.completedAt);

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, {backgroundColor: tint}]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.icon, {backgroundColor: tint}]}>
            <VectorIcon name={envelope.icon} color={colors[white][0]} size={16} />
          </View>

          <View style={styles.headline}>
            <Text size={14} lines={3}>
              {isFund
                ? t('achievements.savedFor', {name: envelope.name})
                : t('achievements.paidOff', {name: envelope.name})}
            </Text>
            <Text size={20} bold style={styles.amount}>
              <Money cents={amount} fontSize={20} />
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text color={colors[gray][0]} size={12} lines={1} style={styles.meta}>
            {envelope.completedAt !== null && formatDisplayDate(envelope.completedAt)}
            {duration !== undefined && ` · ${duration}`}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('achievements.reopenAccessibilityLabel', {name: envelope.name})}
            accessibilityState={{disabled}}
            disabled={disabled}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={() => onPressReopen(envelope)}>
            <Text color={disabled ? colors.inactive[0] : colors[gray][0]} size={12}>
              {t('achievements.reopen')}
            </Text>
          </TouchableOpacity>
        </View>
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
    // `overflow: 'hidden'` para que la franja de color respete el radio
    // de la tarjeta; sin esto asoma cuadrada por las dos esquinas
    // izquierdas.
    overflow: 'hidden',
    // `boxShadow` y no `elevation`: en Android la sombra de `elevation`
    // sigue el contorno RECTANGULAR de la vista y asoma por las esquinas
    // redondeadas como un cuadrado gris.
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.10)',
  },
  stripe: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  },
  amount: {
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  // `flex: 1` y no ancho automatico: sin el, una fecha larga junto a
  // "te tomó 11 meses" empuja el boton de deshacer fuera de la tarjeta
  // en vez de recortarse.
  meta: {
    flex: 1,
    marginRight: 12,
  },
});

export default AchievementCard;
