import {Title} from '@components/atoms/text/Title';
import {Money} from '@components/atoms/text/Money';
import {Text} from '@components/atoms/text/Text';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';

import {colors, gray} from '@constants/colors/colors';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faArrowDownLong} from '@fortawesome/free-solid-svg-icons/faArrowDownLong';
import {faArrowUpLong} from '@fortawesome/free-solid-svg-icons/faArrowUpLong';
import {formatCentsToCurrency} from '@utils/currency';
import i18n from '@i18n';
import {useTranslation} from 'react-i18next';

/**
 * `onLongPress` (opcional) convierte la fila en pulsable para abrir el
 * menu de administrar el movimiento — ver `useTransactionActions`. Sin
 * el, la fila sigue siendo una `View` sin ningun tactil: no todas las
 * listas que pintan movimientos permiten administrarlos (la vista previa
 * de Balance sí, un resumen de solo lectura no tendria por que).
 */
function TransactItem(transactItem: TransactItem) {
  useTranslation();
  const {
    category,
    color,
    date,
    icon,
    amount,
    containerStyle,
    onLongPress,
    compact = false,
  } = transactItem;
  // `amount` is SIGNED integer cents (see the global `TransactItem` type)
  // — never a float, never dollars. `formatCentsToCurrency` already
  // prefixes a negative amount with "-"; only the "+" for a positive one
  // is added here.
  const positive = amount > 0;
  const signColor = positive ? colors.success[0] : colors.error[0];
  const accessibilityLabel = i18n.t('common.transactItemAccessibilityLabel', {
    category,
    date,
    direction: positive ? i18n.t('common.directionIn') : i18n.t('common.directionOut'),
    amount: formatCentsToCurrency(Math.abs(amount)),
  });
  const Wrapper: any = onLongPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.container, compact && styles.containerCompact, containerStyle]}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={onLongPress ? i18n.t('form.manageTransactionHint') : undefined}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.7}>
      <View style={compact ? styles.leftCompact : styles.left}>
        <View
          style={[
            styles.iconChip,
            compact && styles.iconChipCompact,
            {backgroundColor: `${color}33`},
          ]}>
          <VectorIcon name={icon} color={color} size={compact ? 22 : 40} />
        </View>
      </View>
      <View style={styles.center}>
        {compact ? (
          <Text size={14} fontWeight="600" lines={1}>
            {category}
          </Text>
        ) : (
          <Title level={3} numberOfLines={1} marginBottom={0}>
            {category}
          </Title>
        )}
        {/* `lines` (not `numberOfLines`) — this is one of the 8 call
            sites written for `@redshank/native`'s `Text`, which only
            honored its own `lines` prop (see
            `@components/atoms/text/Text`'s own doc comment for why).
            `lines` still works as an alias on the replacement, so this
            wasn't touched in the migration. */}
        <Text color={colors[gray][0]} size={compact ? 12 : 'base'} lines={1}>
          {date}
        </Text>
      </View>
      <View style={styles.right}>
        {compact ? (
          <Text
            size={15}
            bold
            color={signColor}
            lines={1}
            style={styles.amount}>
            {positive && '+'}
            <Money cents={amount} fontSize={15} />
          </Text>
        ) : (
          <Title
            level={3}
            color={signColor}
            numberOfLines={1}
            marginBottom={0}
            style={styles.amount}>
            {positive && '+'}
            <Money cents={amount} fontSize={20} />
          </Title>
        )}
        {/* La flecha se omite en compacto: el signo y el color ya dicen
            si el dinero entra o sale, y liberar esos ~24 de ancho es
            justo lo que evita que el concepto se corte en una fila mas
            estrecha. La etiqueta de accesibilidad SI sigue diciendo la
            direccion en las dos variantes (ver `accessibilityLabel`). */}
        {!compact && (
          <FontAwesomeIcon
            icon={positive ? faArrowUpLong : faArrowDownLong}
            color={signColor}
            size={20}
          />
        )}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    // padding: 10,
  },
  // El icono tiene ancho fijo y el importe ocupa el que necesite; lo que
  // cede espacio es el nombre. Antes las tres columnas eran proporcionales
  // (flex 1.5 / 4 / 1.5) y un importe de cuatro cifras no cabia en su
  // columna, asi que envolvia a dos lineas.
  // 64 en vez de 90 y la mitad de margen: la variante compacta cabe
  // casi al doble de densidad en una lista larga de consulta.
  containerCompact: {
    height: 64,
    marginVertical: 2,
    // La fila normal no necesita sangria: la flecha de direccion hacia
    // de tope a la derecha y el icono de 74 de ancho dejaba aire a la
    // izquierda. Sin flecha y con la columna del icono a 52, el importe
    // quedaba pegado al borde de la tarjeta. Los 10 salen de sobra del
    // ancho que libero la flecha.
    paddingHorizontal: 10,
  },
  left: {
    width: 74,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftCompact: {
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconChip: {
    borderRadius: 10,
    padding: 10,
  },
  iconChipCompact: {
    borderRadius: 10,
    padding: 8,
  },
  center: {
    flex: 1,
    paddingRight: 10,
  },
  right: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    textAlign: 'right',
  },
});

export default TransactItem;
