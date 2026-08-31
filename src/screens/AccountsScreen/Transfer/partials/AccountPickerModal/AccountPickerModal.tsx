import {BottomSheet} from '@components/organisms/feedback/BottomSheet';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import React from 'react';
import {FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {IAccountWithBalance} from '@db/queries';
import {colors, gray, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useTranslation} from 'react-i18next';

type Props = {
  visible: boolean;
  title: string;
  accounts: IAccountWithBalance[];
  onSelect: (accountId: number) => void;
  onClose: () => void;
};

/**
 * The account picker opened by tapping either `AccountSelectorCard` —
 * NOT part of the approved Transfer prototype (that mock only shows the
 * two cards with their selector chevron, not what the chevron opens),
 * so this is a visual decision of my own: a bottom sheet built on the
 * shared `BottomSheet` (this app's own existing "icon-in-a-circle +
 * name + balance" row idiom (`ArchivedAccounts`/`AccountsScreen`'s
 * account rows) rather than inventing new visual language for it.
 * Flagged for design review in this slice's HANDOFF.
 *
 * Was `@redshank/native`'s `Modal` (see the `@redshank/native` removal
 * slice's HANDOFF) — that library's own `Modal` wrapped a plain
 * `RNModal` WITHOUT an `onRequestClose`, so this component used to run
 * its own `BackHandler` listener to keep Android's hardware back button
 * from falling through to the screen underneath (popping `Transfer`
 * off the stack) instead of just closing this sheet. `BottomSheet`
 * renders RN's OWN `Modal` with `onRequestClose` already wired to
 * `onClose`, which RN wires to the hardware back button natively — that
 * `BackHandler` listener is gone, not ported, it's genuinely redundant
 * now.
 *
 * `maxHeight="70%"`: same value this sheet always used, now passed as
 * `BottomSheet`'s own typed prop instead of a raw `contentStyle`
 * override — see that prop's doc comment for why the `FlatList` below
 * ALSO needs its own `flexShrink: 1` (`styles.list`) for this to make
 * it properly scrollable instead of overflowing past the sheet.
 */
const AccountPickerModal = ({visible, title, accounts, onSelect, onClose}: Props) => {
  const {t} = useTranslation();

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="70%">
      <Title level={4} style={styles.title}>
        {title}
      </Title>
      <FlatList
        data={accounts}
        keyExtractor={item => item.id.toString()}
        style={styles.list}
        ListEmptyComponent={
          <Text color={colors[gray][0]} style={styles.empty}>
            {t('transfer.noOtherAccount')}
          </Text>
        }
        renderItem={({item}) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('transfer.pickerRowAccessibilityLabel', {
              name: item.name,
              balance: formatCentsToCurrency(item.balance),
            })}
            onPress={() => onSelect(item.id)}
            style={styles.row}>
            <View style={styles.rowIcon}>
              <VectorIcon name={item.icon} color={colors[white][0]} size={18} />
            </View>
            <View style={styles.rowBody}>
              <Text>{item.name}</Text>
              <Text color={colors[gray][0]} size="xs">
                {formatCentsToCurrency(item.balance)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  // `flexShrink: 1` — see `BottomSheetProps.children`'s doc comment:
  // required alongside `maxHeight="70%"` above for this list to shrink
  // and scroll under the sheet's ceiling instead of overflowing past
  // it.
  list: {
    width: '100%',
    flexShrink: 1,
  },
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors[gray][0],
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  rowBody: {
    flex: 1,
  },
});

export default AccountPickerModal;
