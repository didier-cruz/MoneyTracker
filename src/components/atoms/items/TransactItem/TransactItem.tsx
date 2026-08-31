import {Title, Text} from '@redshank/native';
import {StyleSheet, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';

import {colors, gray} from '@constants/colors/colors';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faArrowDownLong} from '@fortawesome/free-solid-svg-icons/faArrowDownLong';
import {faArrowUpLong} from '@fortawesome/free-solid-svg-icons/faArrowUpLong';
import {formatCentsToCurrency} from '@utils/currency';
import i18n from '@i18n';
import {useTranslation} from 'react-i18next';

function TransactItem(transactItem: TransactItem) {
  useTranslation();
  const {category, color, date, icon, amount, containerStyle} = transactItem;
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
  return (
    <View
      style={[styles.container, containerStyle]}
      accessible
      accessibilityLabel={accessibilityLabel}>
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
        {/* OJO: el Text de @redshank/native aplica numberOfLines DESPUES de
            esparcir el resto de props, asi que sobrescribe el que le pases.
            Su prop propia es `lines`. */}
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
    </View>
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
