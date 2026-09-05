import {useState} from 'react';
import {Money} from '@components/atoms/text/Money';
import {ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import Icon from 'react-native-vector-icons/FontAwesome';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ScreenContainer} from '@components/atoms';
import {ConfirmDialog} from '@components/organisms/feedback';
import Header from '@screens/[categories]/components/Header/Header';
import {accent, colors, gray, secondary, text as textColorKey, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {formatDisplayDate} from '@utils/dateFormat';
import {AccountsAdminNavParams as AccountsNavParams} from '@navigation/[accounts]/AccountsAdminNavigator';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {getKindLabel} from '../CreateAccount/partials/KindField/KindField';
import {IArchivedAccount, useArchivedAccounts} from './useArchivedAccounts';
import {useTranslation} from 'react-i18next';

interface ArchivedAccountsProps
  extends NativeStackScreenProps<AccountsNavParams, 'ArchivedAccounts'> {}

interface RestoreConfirmState {
  visible: boolean;
  account: IArchivedAccount | null;
}

/**
 * Now wires `unarchiveAccount` (added to `@db/queries` after this
 * screen originally shipped read-only — see git history for that
 * earlier slice's own doc comment, which flagged exactly this as a
 * contract request). Each row exposes one action, restoring — no
 * edit/archive menu like `AccountsScreen`'s accounts, since an archived
 * account has nothing else to manage from here.
 *
 * The restore confirmation mirrors `AccountsScreen`'s own archive
 * dialog's shape/tone (same "explain the effect, state the exact
 * amount" pattern — see `onRestoreAccount` below) rather than inventing
 * new confirmation copy, per this slice's "no lenguaje visual nuevo"
 * instruction. Net worth only ever sums ACTIVE accounts
 * (`getNetWorth`), so restoring one with a non-zero balance moves net
 * worth immediately on the next read — up for a positive balance, down
 * for a negative one (e.g. a credit card still carrying debt) — and the
 * dialog says so explicitly, with the exact amount, exactly like
 * archiving already does.
 */
export const ArchivedAccounts = (_props: ArchivedAccountsProps) => {
  const {t} = useTranslation();
  const {accounts, status, errorMessage, reload, restoreAccountById} =
    useArchivedAccounts();

  const {notice, showNotice, dismissNotice} = useNoticeDialog();
  const [restoreConfirm, setRestoreConfirm] = useState<RestoreConfirmState>({
    visible: false,
    account: null,
  });
  const closeRestoreConfirm = () => setRestoreConfirm(prev => ({...prev, visible: false}));
  const confirmingAccount = restoreConfirm.account;

  const restoreMessageFor = (account: IArchivedAccount) => {
    const direction = account.balance > 0 ? t('accounts.movingItUp') : t('accounts.movingItDown');
    const balanceImpact =
      account.balance !== 0
        ? ` ${t('accounts.restoreBalanceImpact', {
            amount: formatCentsToCurrency(account.balance),
            direction,
          })}`
        : '';
    return `${t('accounts.restoreMessage', {name: account.name})}${balanceImpact}`;
  };

  const onPressRestoreAccount = (account: IArchivedAccount) => {
    setRestoreConfirm({visible: true, account});
  };

  const onConfirmRestoreAccount = async () => {
    if (!confirmingAccount) {
      return;
    }
    closeRestoreConfirm();
    const success = await restoreAccountById(confirmingAccount.id);
    if (!success) {
      showNotice('danger', t('common.error'), t('accounts.restoreErrorMessage'));
    }
  };

  return (
    <>
    <ScreenContainer>
      <Header
        title={t('accounts.archivedTitle')}
        message={t('accounts.archivedMessage')}
      />

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('accounts.loadingArchived')}
          />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <Text color={colors[secondary][0]} style={styles.message}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('accounts.retryLoadingArchived')}
            onPress={reload}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && accounts.length === 0 && (
        <View style={styles.centered}>
          <Text color={colors[gray][0]} style={styles.message}>
            {t('accounts.noArchivedAccounts')}
          </Text>
        </View>
      )}

      {status === 'success' && accounts.length > 0 && (
        <FlatList
          data={accounts}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            // Merged into one screen-reader stop, its "restore" action
            // exposed via `accessibilityActions` — same idiom
            // `CatalogCard` already uses for its own nested "manage"
            // button, reused here rather than invented from scratch.
            <View
              style={styles.row}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('accounts.archivedRowAccessibilityLabel', {
                name: item.name,
                kind: getKindLabel(item.kind),
                balance: formatCentsToCurrency(item.balance),
                date: formatDisplayDate(item.archivedAt),
              })}
              accessibilityActions={[{name: 'restore', label: t('accounts.restoreAccountAction')}]}
              onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'restore') {
                  onPressRestoreAccount(item);
                }
              }}>
              <View style={styles.rowIcon}>
                <Icon name={item.icon} color={colors[white][0]} size={18} />
              </View>
              <View style={styles.rowBody}>
                <Text color={colors[textColorKey][0]}>{item.name}</Text>
                <Text color={colors[gray][0]} size={12}>
                  {t('accounts.archivedRowSubtitle', {
                    kind: getKindLabel(item.kind),
                    date: formatDisplayDate(item.archivedAt),
                  })}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Title
                  level={3}
                  color={item.balance < 0 ? colors[secondary][0] : undefined}>
                  {<Money cents={item.balance} fontSize={20} />}
                </Title>
                <TouchableOpacity
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  onPress={() => onPressRestoreAccount(item)}
                  style={styles.restoreButton}>
                  <Text color={colors[accent][2]} size={12}>
                    {t('accounts.restore')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </ScreenContainer>

      <ConfirmDialog
        visible={restoreConfirm.visible}
        tone="info"
        title={t('accounts.restoreTitle')}
        message={confirmingAccount ? restoreMessageFor(confirmingAccount) : ''}
        onRequestClose={closeRestoreConfirm}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={closeRestoreConfirm}
        primaryLabel={t('accounts.restore')}
        onPrimaryPress={onConfirmRestoreAccount}
      />

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={dismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={dismissNotice}
      />
    </>
  );
};

const styles = StyleSheet.create({
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  message: {
    paddingHorizontal: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    height: 44,
    minWidth: 120,
    borderRadius: 10,
    backgroundColor: colors[secondary][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 30,
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
  rowEnd: {
    alignItems: 'flex-end',
  },
  restoreButton: {
    marginTop: 4,
  },
});
