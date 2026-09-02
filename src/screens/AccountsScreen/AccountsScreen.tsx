import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {FragmentSection} from '@components/templates/FragmentSection';
import {
  ConfirmDialog,
  TransactionActionsDialogs,
  useTransactionActions,
} from '@components/organisms/feedback';
import {useNavigation} from '@react-navigation/native';
import {AccountsNavigationProp} from '@navigation/[accounts]/AccountsNavigator/types';
import {accent, colors, gray, primary, secondary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useAccountsScreen} from '@hooks/useAccountsScreen';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {
  ADD_ACCOUNT_CARD_ID,
  formatCurrentMonthLabel,
  groupFinancesByDate,
  mapAccountsToCatalogCards,
} from './mappers';
import {useTranslation} from 'react-i18next';

const AccountsScreen = () => {
  /**
   * La navegacion se toma con `useNavigation` y no de las props porque
   * esta pantalla ya no es una pantalla de stack: es una de las dos
   * pestanas de `MovementsTopTabs`. Las rutas que empuja
   * (`CreateAccount`, `Transfer`, `ArchivedAccounts`, `EditAccount`)
   * viven en el stack de ARRIBA, y react-navigation resuelve un nombre
   * desconocido subiendo por el arbol — el mismo apano que ya usaba
   * `CategoriesScreen` con `CreateCategoryNavigationProp`.
   */
  const navigation = useNavigation<AccountsNavigationProp>();
  const {t} = useTranslation();
  const {
    accounts,
    accountsStatus,
    accountsErrorMessage,
    netWorth,
    reloadAccounts,
    selectedAccountId,
    selectAccount,
    financeItems,
    financesStatus,
    financesErrorMessage,
    reloadFinances,
    isLoadingMore,
    loadMoreFinances,
    isRefreshing,
    refresh,
  } = useAccountsScreen();

  // La edicion vive en otro stack (`Outcomes` -> `EditTransaction`), asi
  // que se navega por el navegador padre sin tipar el destino, igual que
  // hace `FormScreen` para volver a Balance.
  const transactionActions = useTransactionActions({
    onEdit: financeId =>
      // `Outcomes` es una pestana INFERIOR: no esta en este stack ni en
      // el navegador de pestanas superiores, asi que se navega por
      // nombre y react-navigation sube hasta encontrarla.
      (navigation as any).navigate('Outcomes', {
        screen: 'EditTransaction',
        params: {financeId},
      }),
    onChanged: refresh,
  });

  const {notice, dismissNotice} = useNoticeDialog();
  const onPressCatalogItem = (id: number) => {
    if (id === ADD_ACCOUNT_CARD_ID) {
      navigation.navigate('CreateAccount');
      return;
    }
    selectAccount(id);
  };

  // The movements list below needs the SELECTED account's name (see
  // `stateStyles.netWorth`'s sibling `FragmentSection` call below) —
  // `onPressManageAccount` above already does this same lookup for its
  // own alert title, kept separate since it only runs on a press, not
  // every render.
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <>
      {/* Sin `headerTitle`: el encabezado de esta pantalla lo pinta
          `MovementsTopTabs`, una sola vez y encima de la fila de
          pestanas — ver su comentario. */}
      <ScreenTemplate>
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
              {/* `marginBottom={0}`: `Title` nivel 2 trae 15 por
                  defecto —heredado de la libreria que se retiro— y aqui
                  no separa nada, porque la fila esta alineada por
                  linea base y el hueco de abajo ya lo pone el
                  contenedor. Era la mayor parte del espacio entre el
                  patrimonio y las tarjetas. */}
              <Title level={2} color={colors[primary][0]} marginBottom={0}>
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
            onLongPressFinance={transactionActions.open}
            data={mapAccountsToCatalogCards(accounts)}
            selectedId={selectedAccountId ?? ADD_ACCOUNT_CARD_ID}
            onPressItem={onPressCatalogItem}
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

      {/* Ni menu de administrar ni confirmacion de archivar: la
          administracion de cuentas vive ahora en el menu lateral
          (`AccountsAdminScreen`). Esta pestana es para RECORRER los
          movimientos de una cuenta. */}
      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={dismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={dismissNotice}
      />
      <TransactionActionsDialogs {...transactionActions.dialogProps} />

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
