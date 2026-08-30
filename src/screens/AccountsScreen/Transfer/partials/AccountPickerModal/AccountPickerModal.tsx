import {Modal, Text, Title} from '@redshank/native';
import React, {useEffect} from 'react';
import {BackHandler, FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
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
 * so this is a visual decision of my own: a bottom sheet reusing
 * `@redshank/native`'s `Modal` (`position="bottom"`, already used
 * elsewhere in this design system) and this app's own existing
 * "icon-in-a-circle + name + balance" row idiom
 * (`ArchivedAccounts`/`AccountsScreen`'s account rows) rather than
 * inventing new visual language for it. Flagged for design review in
 * this slice's HANDOFF.
 *
 * `@redshank/native`'s `Modal` wraps a plain `RNModal` WITHOUT an
 * `onRequestClose`, so Android's hardware back button would otherwise
 * fall through to the underlying screen (popping `Transfer` off the
 * stack while this sheet is still open) instead of just closing the
 * sheet — the `BackHandler` listener below exists specifically to close
 * this need, only while `visible`.
 *
 * `closable={false}`: `Modal`'s own default close button renders an
 * `Ionicons` glyph (`type="ionicon"`), and this app's `Info.plist` only
 * registers `FontAwesome.ttf` under `UIAppFonts` (Android's
 * `fonts.gradle` bundles every vector-icons font automatically, but iOS
 * does not) — that default button would render as a missing-glyph box
 * on iOS. Rather than editing a native project file for one button
 * (out of this slice's scope, and a real "native change" that would
 * need a fresh iOS build to land — see this slice's HANDOFF), this
 * sheet is closed instead by tapping outside it (`maskClosable`), the
 * Android hardware back button (below), or picking an account —
 * discoverability for the tap-outside path relies on the visible gap
 * above the sheet (`position="bottom"` never covers the full screen).
 */
const AccountPickerModal = ({visible, title, accounts, onSelect, onClose}: Props) => {
  const {t} = useTranslation();
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      position="bottom"
      maskClosable
      closable={false}
      contentStyle={styles.content}
      contentContainerStyle={styles.contentContainer}>
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  contentContainer: {
    width: '100%',
  },
  title: {
    marginBottom: 10,
  },
  list: {
    width: '100%',
  },
  empty: {
    paddingVertical: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
