import {black, colors, gray, white} from '@constants/colors/colors';
import {Headings} from '@components/atoms/text/Headings/Headings';
import {IAccountWithBalance} from '@db/queries';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';

type Props = {
  accounts: IAccountWithBalance[];
  selectedAccount: IAccountWithBalance | undefined;
  onSelectAccount: (account: IAccountWithBalance) => void;
  status: 'loading' | 'success' | 'error';
  errorMessage: string;
};

/**
 * The account picker for the transaction amount card — per the
 * approved prototype, the account is chosen from this card, not a
 * separate screen. Visually mirrors the category-grid selection
 * already on this screen (black pill when selected) for consistency,
 * since this screen has no other approved reference for it.
 */
const AccountSelector = ({
  accounts,
  selectedAccount,
  onSelectAccount,
  status,
  errorMessage,
}: Props) => {
  const {t} = useTranslation();

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="small"
          color={colors[black][0]}
          accessibilityLabel={t('form.loadingAccounts')}
        />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <Headings
        headingSize="H6"
        color={colors[gray][0]}
        containerStyle={styles.message}>
        {errorMessage}
      </Headings>
    );
  }

  if (accounts.length === 0) {
    return (
      <Headings
        headingSize="H6"
        color={colors[gray][0]}
        containerStyle={styles.message}>
        {t('form.createAccountFirst')}
      </Headings>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}>
      {accounts.map(account => {
        const isSelected = selectedAccount?.id === account.id;
        return (
          <TouchableOpacity
            key={account.id}
            accessibilityRole="button"
            accessibilityLabel={t('form.selectAccountAccessibilityLabel', {name: account.name})}
            accessibilityState={{selected: isSelected}}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelectAccount(account)}>
            <Icon
              name={account.icon}
              size={16}
              color={isSelected ? colors[white][0] : colors[black][0]}
            />
            <Text
              style={[styles.pillText, isSelected && styles.pillTextSelected]}>
              {account.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  message: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 14,
    marginHorizontal: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors[black][0],
  },
  pillSelected: {
    backgroundColor: colors[black][0],
  },
  pillText: {
    marginLeft: 6,
    fontSize: 12,
    color: colors[black][0],
  },
  pillTextSelected: {
    color: colors[white][0],
  },
});

export default AccountSelector;
