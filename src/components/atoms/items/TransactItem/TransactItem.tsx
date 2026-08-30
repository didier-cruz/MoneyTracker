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
        <Title level={3}>{category}</Title>
        <Text color={colors[gray][0]} style={{marginTop: -5}}>
          {date}
        </Text>
      </View>
      <View style={styles.right}>
        <Title level={3} color={signColor}>
          {positive && '+'}
          {formatCentsToCurrency(amount)}
        </Title>
        <FontAwesomeIcon
          icon={positive ? faArrowUpLong : faArrowDownLong}
          color={signColor}
          size={25}
          style={{marginTop: -10}}
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
  left: {
    flex: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {flex: 4},
  right: {
    flex: 1.5,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TransactItem;
