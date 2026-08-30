import {ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text, Title} from '@redshank/native';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {FragmentSection} from '@components/templates/FragmentSection';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {AccountsNavParams} from '@navigation/[accounts]/AccountsNavigator/types';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useAccountsScreen} from '@hooks/useAccountsScreen';
import {IAccountWithBalance} from '@db/queries';
import {ADD_ACCOUNT_CARD_ID, groupFinancesByDate, mapAccountsToCatalogCards} from './mappers';
import {useTranslation} from 'react-i18next';

interface AccountsScreenProps
  extends NativeStackScreenProps<AccountsNavParams, 'Accounts'> {}

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
  const onArchiveAccount = (account: IAccountWithBalance) => {
    const balanceImpact =
      account.balance !== 0
        ? ` ${t('accounts.archiveBalanceImpact', {
            amount: formatCentsToCurrency(account.balance),
          })}`
        : '';
    Alert.alert(
      t('accounts.archiveTitle'),
      `${t('accounts.archiveMessage', {name: account.name})}${balanceImpact}`,
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('accounts.archive'),
          style: 'destructive',
          onPress: async () => {
            const success = await archiveAccountById(account.id);
            if (!success) {
              Alert.alert(t('common.error'), t('accounts.archiveErrorMessage'));
            }
          },
        },
      ],
    );
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
    Alert.alert(account.name, undefined, [
      {
        text: t('common.edit'),
        onPress: () => navigation.navigate('EditAccount', {accountId: id}),
      },
      {
        text: t('accounts.archive'),
        style: 'destructive',
        onPress: () => onArchiveAccount(account),
      },
      {text: t('common.cancel'), style: 'cancel'},
    ]);
  };

  return (
    <ScreenTemplate headerTitle={t('accounts.title')}>
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

          <View style={stateStyles.netWorth} accessible accessibilityRole="text">
            <Text color={colors[gray][0]} size={12}>
              {t('accounts.netWorth')}
            </Text>
            <Title level={1}>{formatCentsToCurrency(netWorth)}</Title>
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
  linksRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
    marginBottom: 10,
  },
});

export default AccountsScreen;
