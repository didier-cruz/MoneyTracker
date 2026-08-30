import {Text} from '@redshank/native';
import React from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import {colors, inactive, white} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

type Props = {
  amountText: string;
  onChangeAmountText: (text: string) => void;
};

/**
 * The indigo amount card from the approved prototype — a single
 * `decimal-pad` input, no separate keypad component: this app already
 * has a working amount-entry idiom (`FormScreen`'s own `TextInput`) and
 * this screen's job is only to reuse it with this card's styling, not
 * to invent a new numeric input.
 */
const AmountCard = ({amountText, onChangeAmountText}: Props) => {
  const {t} = useTranslation();
  return (
    <View style={styles.card}>
      <Text color={colors[white][0]} size="xs" style={styles.label}>
        {t('transfer.amountLabel')}
      </Text>
      <TextInput
        value={amountText}
        onChangeText={onChangeAmountText}
        placeholder="$0.00"
        placeholderTextColor={colors[inactive][0]}
        keyboardType="decimal-pad"
        returnKeyType="done"
        accessibilityLabel={t('transfer.amountLabel')}
        style={styles.input}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.primary[0],
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  label: {
    marginBottom: 4,
  },
  input: {
    width: '100%',
    textAlign: 'center',
    color: colors[white][0],
    fontSize: 34,
    fontWeight: 'bold',
    padding: 0,
  },
});

export default AmountCard;
