import {colors, white} from '@constants/colors/colors';
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

// The prototype's account row lives INSIDE the indigo `#010062` amount
// card, with a muted-indigo icon/label color (`#9C9AC8`) for the
// unselected state and white for the selected one — there's no token
// for that muted indigo in `@constants/colors` (it's specific to this
// one card), same precedent as `TypeSegment`'s own `#EDEDF2`.
const MUTED_ON_CARD = '#9C9AC8';

/**
 * The account picker for the transaction amount card — per the
 * approved prototype, the account is chosen from this card, not a
 * separate screen. Restyled for the card's indigo background (was
 * previously white-card/black-pill styling from before this card
 * existed at all).
 *
 * The prototype itself only draws ONE account row (icon + name +
 * chevron), implying a single current selection that some picker
 * opens on tap. This component instead shows every account as a
 * horizontally-scrollable row of pills, all selectable inline — that
 * behavior already existed and works; this pass only restyles it for
 * the dark card. Rebuilding it as a chevron-triggered picker sheet
 * would duplicate `Transfer`'s own `AccountPickerModal` pattern for no
 * functional gain here (usually 1-3 accounts, all fit on one row), so
 * it's flagged as a known visual delta in the HANDOFF instead of
 * built.
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
          color={colors[white][0]}
          accessibilityLabel={t('form.loadingAccounts')}
        />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <Headings
        headingSize="H6"
        color={MUTED_ON_CARD}
        containerStyle={styles.message}>
        {errorMessage}
      </Headings>
    );
  }

  if (accounts.length === 0) {
    return (
      <Headings
        headingSize="H6"
        color={MUTED_ON_CARD}
        containerStyle={styles.message}>
        {t('form.createAccountFirst')}
      </Headings>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Android measures a horizontal `ScrollView` with no explicit
      // `style` height as free to grow along the CROSS axis (vertical,
      // for a `column` parent) instead of hugging its tallest pill —
      // it was silently stretching this whole card to fill the rest
      // of the screen. Pinning it to the pill's own height fixes that
      // without touching `contentContainerStyle` (which only sizes the
      // scrollable content, not the ScrollView itself).
      style={styles.scrollView}
      contentContainerStyle={styles.list}>
      {accounts.map(account => {
        const isSelected = selectedAccount?.id === account.id;
        return (
          <TouchableOpacity
            key={account.id}
            accessibilityRole="button"
            accessibilityLabel={t('form.selectAccountAccessibilityLabel', {name: account.name})}
            accessibilityState={{selected: isSelected}}
            hitSlop={{top: 6, bottom: 6}}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelectAccount(account)}>
            <Icon
              name={account.icon}
              size={16}
              color={isSelected ? colors[white][0] : MUTED_ON_CARD}
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
    paddingVertical: 4,
  },
  message: {
    paddingHorizontal: 4,
    marginTop: 0,
  },
  scrollView: {
    flexGrow: 0,
    height: 32,
  },
  list: {
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pillSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pillText: {
    marginLeft: 6,
    fontSize: 14,
    color: MUTED_ON_CARD,
  },
  pillTextSelected: {
    color: colors[white][0],
  },
});

export default AccountSelector;
