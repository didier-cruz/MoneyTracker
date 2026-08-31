import {useState} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text, Title} from '@redshank/native';
import {faPen} from '@fortawesome/free-solid-svg-icons/faPen';
import {faBoxArchive} from '@fortawesome/free-solid-svg-icons/faBoxArchive';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {FragmentSection} from '@components/templates/FragmentSection';
import {ActionSheet, ConfirmDialog} from '@components/organisms/feedback';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {AccountsNavParams} from '@navigation/[accounts]/AccountsNavigator/types';
import {accent, colors, gray, primary, secondary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useAccountsScreen} from '@hooks/useAccountsScreen';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {IAccountWithBalance} from '@db/queries';
import {
  ADD_ACCOUNT_CARD_ID,
  formatCurrentMonthLabel,
  groupFinancesByDate,
  mapAccountsToCatalogCards,
} from './mappers';
import {useTranslation} from 'react-i18next';

interface AccountsScreenProps
  extends NativeStackScreenProps<AccountsNavParams, 'AccountsHome'> {}

interface AccountMenuState {
  visible: boolean;
  account: IAccountWithBalance | null;
}

interface ArchiveAccountConfirmState {
  visible: boolean;
  account: IAccountWithBalance | null;
}

const AccountsScreen = ({navigation}: AccountsScreenProps) => {
  const {t} = useTranslation();
  const {
    accounts,
    accountsStatus,
    accountsErrorMessage,
    netWorth,
    reloadAccounts,
    selectedAccountId,
    selectAccount,
    archiveAccountById,
    financeItems,
    financesStatus,
    financesErrorMessage,
    reloadFinances,
    isLoadingMore,
    loadMoreFinances,
    isRefreshing,
    refresh,
  } = useAccountsScreen();

  const {notice, showNotice, dismissNotice} = useNoticeDialog();
  const [accountMenu, setAccountMenu] = useState<AccountMenuState>({
    visible: false,
    account: null,
  });
  const [archiveConfirm, setArchiveConfirm] = useState<ArchiveAccountConfirmState>({
    visible: false,
    account: null,
  });

  const closeAccountMenu = () => setAccountMenu(prev => ({...prev, visible: false}));
  const closeArchiveConfirm = () => setArchiveConfirm(prev => ({...prev, visible: false}));
  const menuAccount = accountMenu.account;
  const confirmingAccount = archiveConfirm.account;

  const onPressCatalogItem = (id: number) => {
    if (id === ADD_ACCOUNT_CARD_ID) {
      navigation.navigate('CreateAccount');
      return;
    }
    selectAccount(id);
  };

  // Confirmation dialog, not the manage menu itself (see
  // `onPressManageAccount`) — archiving is a soft delete in the data
  // layer, but from the user's seat it reads as final ("this account is
  // gone"), so it gets its own explicit step. The copy spells out both
  // halves of that: nothing is deleted (movements are kept, it can be
  // viewed under "Archived accounts"), AND its balance stops counting
  // toward net worth the moment it's archived — that second part only
  // applies when the balance isn't already zero, so it's the one piece
  // of this message built conditionally.
  const archiveMessageFor = (account: IAccountWithBalance) => {
    const balanceImpact =
      account.balance !== 0
        ? ` ${t('accounts.archiveBalanceImpact', {
            amount: formatCentsToCurrency(account.balance),
          })}`
        : '';
    return `${t('accounts.archiveMessage', {name: account.name})}${balanceImpact}`;
  };

  const onConfirmArchiveAccount = async () => {
    if (!confirmingAccount) {
      return;
    }
    closeArchiveConfirm();
    const success = await archiveAccountById(confirmingAccount.id);
    if (!success) {
      showNotice('danger', t('common.error'), t('accounts.archiveErrorMessage'));
    }
  };

  // The one gesture for "manage this account" (edit/archive) — there is
  // no approved prototype for this screen at all (see this file's
  // HANDOFF note), so this reuses the app's existing "ellipsis -> menu"
  // idiom (`CategoriesList`'s add-category action, `SymbolList`'s header
  // action) rather than inventing a swipe/long-press gesture with no
  // precedent here. `CatalogCard` renders the visible ellipsis button
  // AND exposes the same action to screen readers via
  // `accessibilityActions` (see that component).
  const onPressManageAccount = (id: number) => {
    const account = accounts.find(a => a.id === id);
    if (!account) {
      return;
    }
    setAccountMenu({visible: true, account});
  };

  // The movements list below needs the SELECTED account's name (see
  // `stateStyles.netWorth`'s sibling `FragmentSection` call below) —
  // `onPressManageAccount` above already does this same lookup for its
  // own alert title, kept separate since it only runs on a press, not
  // every render.
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <>
      {/* Two-line "Mis" / "Cuentas" header per the approved prototype —
          `accounts.title` ("Cuentas") is ALSO this tab's route title (see
          `HomeBottomTabs/router.tsx`), so it stays the bare noun and the
          "Mis" line is its own key (`accounts.titlePrefix`) rather than
          baking both words into `accounts.title` itself, which would leak
          "Mis" into the tab bar label too. */}
      <ScreenTemplate
        headerTitle={t('accounts.titlePrefix')}
        headerSubtitle={t('accounts.title')}>
      {accountsStatus === 'loading' && (
        <View style={stateStyles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('accounts.loadingAccounts')}
          />
        </View>
      )}

      {accountsStatus === 'error' && (
        <View style={stateStyles.centered}>
          <Text color={colors[secondary][0]} style={stateStyles.message}>
            {accountsErrorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('accounts.retryLoadingAccounts')}
            onPress={reloadAccounts}
            style={stateStyles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {accountsStatus === 'success' && (
        <>
          {/* Placement/copy not from an approved prototype — flagged in
              HANDOFF for review. Kept OUTSIDE the `accessible` net-worth
              block below it on purpose: that block merges into one
              screen-reader stop, which would swallow these links' own
              focus stops if they were nested inside instead.
              `Transfer` (slice B3) is the entry point into that screen —
              see `AccountsNavigator`'s doc comment for why this
              navigator, not the "New movement" tab, hosts it. There is
              no approved design for THIS button; it reuses the row's
              existing plain-link idiom, just with an `accent` fill so
              it doesn't read as equally secondary to "Archived
              accounts" — also flagged for review. */}
          <View style={stateStyles.linksRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('accounts.transferAccessibilityLabel')}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={() => navigation.navigate('Transfer')}
              style={stateStyles.transferLink}>
              <Text color={colors[accent][3]} size={12}>
                {t('accounts.transfer')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('accounts.viewArchivedAccessibilityLabel')}
              hitSlop={{top: 10, bottom: 10, left: 20, right: 20}}
              onPress={() => navigation.navigate('ArchivedAccounts')}
              style={stateStyles.archivedLink}>
              <Text color={colors[gray][0]} size={12} style={stateStyles.archivedLinkText}>
                {t('accounts.archivedAccounts')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Label + amount on ONE baseline-aligned row, per the approved
              prototype — was previously stacked (label above, amount
              below) at `Title level={1}` (30px, default dark text). The
              prototype's amount is 25px BOLD ÍNDIGO (`Title level={2}`,
              `colors.primary[0]`), not the theme's default text color —
              same "pass the raw token as `color`" idiom `CatalogCard`
              already uses for its negative-balance red. */}
          <View style={stateStyles.netWorth} accessible accessibilityRole="text">
            <View style={stateStyles.netWorthRow}>
              <Text
                color={colors[gray][0]}
                size={12}
                transform="uppercase"
                style={stateStyles.netWorthLabel}>
                {t('accounts.netWorth')}
              </Text>
              <Title level={2} color={colors[primary][0]}>
                {formatCentsToCurrency(netWorth)}
              </Title>
            </View>
          </View>

          {accounts.length === 0 ? (
            <View style={stateStyles.centered}>
              <Text color={colors[gray][0]} style={stateStyles.message}>
                {t('accounts.emptyState')}
              </Text>
            </View>
          ) : null}

          <FragmentSection
            data={mapAccountsToCatalogCards(accounts)}
            selectedId={selectedAccountId ?? ADD_ACCOUNT_CARD_ID}
            onPressItem={onPressCatalogItem}
            onPressManageItem={onPressManageAccount}
            transactSections={groupFinancesByDate(financeItems)}
            transactHeaderTitle={selectedAccount?.name ?? ''}
            transactHeaderSubtitle={formatCurrentMonthLabel()}
            financesStatus={financesStatus}
            financesErrorMessage={financesErrorMessage}
            onRetryFinances={reloadFinances}
            isLoadingMoreFinances={isLoadingMore}
            onEndReachedFinances={loadMoreFinances}
            refreshingFinances={isRefreshing}
            onRefreshFinances={refresh}
          />
        </>
      )}
      </ScreenTemplate>

      <ActionSheet
        visible={accountMenu.visible}
        title={menuAccount?.name ?? ''}
        onClose={closeAccountMenu}
        actions={
          menuAccount
            ? [
                {
                  key: 'edit',
                  label: t('common.edit'),
                  icon: faPen,
                  onPress: () =>
                    navigation.navigate('EditAccount', {accountId: menuAccount.id}),
                },
                {
                  key: 'archive',
                  label: t('accounts.archive'),
                  icon: faBoxArchive,
                  tone: 'destructive',
                  onPress: () => setArchiveConfirm({visible: true, account: menuAccount}),
                },
              ]
            : []
        }
      />

      <ConfirmDialog
        visible={archiveConfirm.visible}
        tone="danger"
        title={t('accounts.archiveTitle')}
        message={confirmingAccount ? archiveMessageFor(confirmingAccount) : ''}
        onRequestClose={closeArchiveConfirm}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={closeArchiveConfirm}
        primaryLabel={t('accounts.archive')}
        destructive
        onPrimaryPress={onConfirmArchiveAccount}
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

const stateStyles = StyleSheet.create({
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
  // Sin inset propio: la pantalla ya aporta su padding y asi esta fila
  // queda alineada verticalmente con la cabecera de la lista de
  // movimientos ("Efectivo") y con la primera tarjeta de cuenta.
  linksRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  transferLink: {
    height: 26,
    paddingHorizontal: 14,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: colors[accent][0],
  },
  archivedLink: {
    paddingHorizontal: 0,
  },
  archivedLinkText: {
    textDecorationLine: 'underline',
  },
  netWorth: {
    width: '100%',
    marginBottom: 10,
  },
  netWorthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  netWorthLabel: {
    letterSpacing: 0.7,
  },
});

export default AccountsScreen;
