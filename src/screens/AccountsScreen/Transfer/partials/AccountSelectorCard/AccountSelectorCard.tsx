import {Text} from '@components/atoms/text/Text';
import {Money} from '@components/atoms/text/Money';
import {Title} from '@components/atoms/text/Title';
import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {IAccountWithBalance} from '@db/queries';
import {colors, gray, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useTranslation} from 'react-i18next';

type Props = {
  /** "Desde" / "Hacia" — the approved prototype's own label for this
   * card, shown as a small caption so the two otherwise-identical cards
   * are told apart. */
  label: string;
  account: IAccountWithBalance;
  onPress: () => void;
};

/**
 * The "Desde"/"Hacia" card from the approved Transfer prototype: 20
 * radius, a 46x46/10-radius icon box, the account name in bold 18px
 * (`Title level={4}` — `Title`'s own default `font="bold"` already
 * gives the "bold" half for free), the balance below it, and a
 * selector chevron on the right. The whole card is one tap target that
 * opens `AccountPickerModal` — there is no separate hit area for the
 * chevron alone.
 */
const AccountSelectorCard = ({label, account, onPress}: Props) => {
  const {t} = useTranslation();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('transfer.selectorAccessibilityLabel', {
        label,
        name: account.name,
        balance: formatCentsToCurrency(account.balance),
      })}
      accessibilityHint={t('transfer.selectorAccessibilityHint')}
      onPress={onPress}
      style={styles.card}>
      <Text color={colors[gray][0]} size="xs" style={styles.label}>
        {label}
      </Text>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <VectorIcon name={account.icon} color={colors[white][0]} size={20} />
        </View>
        <View style={styles.info}>
          <Title level={4}>{account.name}</Title>
          <Text color={colors[gray][0]} size="sm">
            {<Money cents={account.balance} fontSize={18} />}
          </Text>
        </View>
        <VectorIcon name="chevron-right" color={colors[gray][0]} size={16} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors[white][0],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // `boxShadow` y no `elevation`: en Android la sombra de `elevation`
    // sigue el contorno RECTANGULAR de la vista y asomaba por las
    // esquinas de las tarjetas redondeadas como un cuadrado gris.
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.10)',
  },
  label: {
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary[0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  info: {
    flex: 1,
  },
});

export default AccountSelectorCard;
