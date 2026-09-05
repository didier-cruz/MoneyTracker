import {useState} from 'react';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {Money} from '@components/atoms/text/Money';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {EntityPickerSheet} from '@components/organisms/pickers';
import {FragmentSection} from '@components/templates/FragmentSection';
import {
  ConfirmDialog,
  TransactionActionsDialogs,
  useTransactionActions,
} from '@components/organisms/feedback';
import {useNavigation} from '@react-navigation/native';
import {AccountsNavigationProp} from '@navigation/[accounts]/AccountsNavigator/types';
import {accent, colors, gray, primary, secondary, white} from '@constants/colors/colors';
import {useAccountsScreen} from '@hooks/useAccountsScreen';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {
  ADD_ACCOUNT_CARD_ID,
  NO_ACCOUNT_SELECTED_ID,
  SEE_ALL_ACCOUNTS_CARD_ID,
  sortAccountsByRelevance,
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
    lastUsed,
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
  const [pickerOpen, setPickerOpen] = useState(false);

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
    if (id === SEE_ALL_ACCOUNTS_CARD_ID) {
      setPickerOpen(true);
      return;
    }
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

          {/* Label + amount on ONE baseline-aligned row, per the approved
              prototype — was previously stacked (label above, amount
              below) at `Title level={1}` (30px, default dark text). The
              prototype's amount is 25px BOLD ÍNDIGO (`Title level={2}`,
              `colors.primary[0]`), not the theme's default text color —
              same "pass the raw token as `color`" idiom `CatalogCard`
              already uses for its negative-balance red. */}
          {/*
            El patrimonio y "Transferir" comparten fila.
            "Transferir" era antes una pastilla de 26 de alto con radio
            13 sobre el patrimonio. Ese es EL MISMO lenguaje que usan los
            chips de filtro de la app —Gastos/Ingresos, los filtros
            aplicados de "Todos los movimientos"—, asi que el ojo lo
            clasificaba como filtro y no como accion. Y su `hitSlop: 10`
            era la confesion de que lo dibujado no llegaba al objetivo
            tactil. Ahora es un boton de 44 con icono, en la mitad
            derecha de esta fila, que estaba vacia: no cuesta ni un pixel
            de alto y las tarjetas de cuenta no se mueven.
            Relleno LIMA y no indigo a proposito: el indigo es el color
            de la cifra que queda justo a su izquierda, y dos cosas del
            mismo color en la misma fila compiten. Contraste 8.72:1.
            El boton va FUERA del bloque `accessible` de al lado, no
            dentro: ese bloque se fusiona en una sola parada de lector de
            pantalla y se tragaria la del boton.
          */}
          <View style={stateStyles.netWorthRow}>
            <View style={stateStyles.netWorth} accessible accessibilityRole="text">
              <View style={stateStyles.netWorthFigure}>
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
                  {<Money cents={netWorth} fontSize={25} />}
                </Title>
              </View>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('accounts.transferAccessibilityLabel')}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Transfer')}
              style={stateStyles.transferButton}>
              <VectorIcon name="exchange" size={15} color={colors[primary][0]} />
              <Text color={colors[primary][0]} size={14} fontWeight="600">
                {t('accounts.transfer')}
              </Text>
            </TouchableOpacity>
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
            onPressSeeAllFinances={() =>
              (navigation as any).navigate('AllMovements', {
                idAccount: selectedAccountId,
              })
            }
            data={mapAccountsToCatalogCards(accounts, lastUsed, selectedAccountId)}
            selectedId={selectedAccountId ?? NO_ACCOUNT_SELECTED_ID}
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
      <EntityPickerSheet
        entity="account"
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('entityPicker.accountsTitle')}
        searchPlaceholder={t('entityPicker.searchAccount')}
        items={sortAccountsByRelevance(accounts, lastUsed).map(account => ({
          id: account.id,
          name: account.name,
          icon: account.icon,
          amount: account.balance,
        }))}
        selectedId={selectedAccountId}
        onSelect={selectAccount}
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
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // 44 es el suelo habitual para un objetivo tactil. Con 26 hacia
    // falta un `hitSlop` que lo agrandara por debajo; ahora el area
    // pulsable es la que se ve.
    height: 44,
    paddingHorizontal: 16,
    // Radio 12, no la mitad del alto: una pastilla completa es la forma
    // que esta app reserva para los chips de filtro.
    borderRadius: 12,
    backgroundColor: colors[accent][1],
  },
  netWorth: {
    // Cede ancho al boton si la cifra crece, en vez de empujarlo fuera.
    flexShrink: 1,
  },
  netWorthRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  netWorthFigure: {
    // Apilado, no en una sola linea base.
    //
    // El prototipo aprobado ponia etiqueta e importe en la MISMA linea
    // base, y asi estuvo hasta ahora. Deja de caber al meter el boton en
    // esta fila: medido en el emulador, 674px de contenido para 657
    // disponibles, y el final del importe quedaba tapado por el boton.
    // Apilar le da al importe toda la columna izquierda —unos 700— y
    // evita tener que encoger su fuente, que ademas pelearia con el
    // tamano fijo de los centavos de `<Money>`.
    // Es una desviacion consciente del prototipo, anotada aqui porque el
    // prototipo no contemplaba ningun boton en esta fila.
    flexShrink: 1,
  },
  netWorthLabel: {
    letterSpacing: 0.7,
  },
});

export default AccountsScreen;
