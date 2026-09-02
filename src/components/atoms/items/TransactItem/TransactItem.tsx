import {Title} from '@components/atoms/text/Title';
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
  const {category, color, date, icon, amount, containerStyle, onLongPress} =
    transactItem;
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
      style={[styles.container, containerStyle]}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={onLongPress ? i18n.t('form.manageTransactionHint') : undefined}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.7}>
      <View style={styles.left}>
        <View
          style={{
            borderRadius: 10,
            backgroundColor: `${color}33`,
            padding: 10,
          }}>
          <VectorIcon name={icon} color={color} size={40} />
        </View>
      </View>
      <View style={styles.center}>
        <Title level={3} numberOfLines={1} marginBottom={0}>
          {category}
        </Title>
        {/* `lines` (not `numberOfLines`) — this is one of the 8 call
            sites written for `@redshank/native`'s `Text`, which only
            honored its own `lines` prop (see
            `@components/atoms/text/Text`'s own doc comment for why).
            `lines` still works as an alias on the replacement, so this
            wasn't touched in the migration. */}
        <Text color={colors[gray][0]} lines={1}>
          {date}
        </Text>
      </View>
      <View style={styles.right}>
        <Title
          level={3}
          color={signColor}
          numberOfLines={1}
          marginBottom={0}
          style={styles.amount}>
          {positive && '+'}
          {formatCentsToCurrency(amount)}
        </Title>
        <FontAwesomeIcon
          icon={positive ? faArrowUpLong : faArrowDownLong}
          color={signColor}
          size={20}
        />
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
  left: {
    width: 74,
    justifyContent: 'center',
    alignItems: 'center',
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
