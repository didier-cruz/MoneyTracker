import React, {useState} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {ScreenContainer, ScrollContainer} from '@components/atoms';
import {useNavigation} from '@react-navigation/native';
import {ChipSelect} from '@components/atoms/ChipSelect';
// El tipo de navegacion se toma del stack de administracion, que
// declara las MISMAS rutas (`CreateCategory`, `EditCategory`) que los
// otros dos stacks donde esta pantalla puede vivir. Es un tipado por
// forma, no por identidad del navegador.
import {CategoriesAdminNavigationProp as CreateCategoryNavigationProp} from '@navigation/[categories]/CategoriesAdminNavigator';
import {useCategoriesScreen} from '@hooks/useCategoriesScreen';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {
  TransactionActionsDialogs,
  useTransactionActions,
} from '@components/organisms/feedback';
import CatalogList from '@components/organisms/Lists/CatalogList/CatalogList';
import {CategoryMovementsList} from './partials';
import {
  ADD_CATEGORY_CARD_ID,
  groupCategoryFinancesByDate,
  mapCategoriesToCatalogCards,
} from './mappers';
import {useTranslation} from 'react-i18next';
import {formatCentsToCurrency} from '@utils/currency';

/**
 * El tipo (gastos / ingresos) ya NO viene en la ruta.
 *
 * Antes esta pantalla se montaba dos veces bajo un navegador de
 * pestanas Gastos|Ingresos que le pasaba `financeType` como parametro.
 * Ahora vive bajo las pestanas Cuentas|Categorias de Movimientos, y
 * apilar una segunda fila de pestanas dentro de la primera es
 * exactamente el amontonamiento que este rediseno viene a quitar. El
 * tipo pasa a ser un filtro segmentado DENTRO de la pantalla: se ve
 * igual de claro y no compite con la navegacion de arriba.
 */
type FinanceType = 'expenses' | 'incomes';

/**
 * "Categorías" — lists the active tab's REAL categories
 * (`getCategoriesByType`, one type per tab: `Expenses` -> `'expense'`,
 * `Incomes` -> `'income'`, see `mappers.ts`'s `financeTypeToCategoryType`
 * for the plural/singular bridge), each with its current-period total,
 * in a 3-column grid; selecting one loads and paginates its movements
 * (`getFinances({idCategory})`, keyset — same strategy as
 * `AccountsScreen`). The dashed "New" tile at the end of the grid is the
 * existing, working `CreateCategory` entry point (unchanged).
 *
 * This replaces the previous placeholder entirely: that version's
 * `CategoriesList` rendered the static 16-icon symbol picker from
 * `@data/icons` (a leftover from before categories/movements existed in
 * the DB) and silently ignored `route.params.financeType`, so both tabs
 * showed the exact same icon grid. `CategoriesList` had no other
 * callers (`SymbolList`, `CreateCategory`'s own icon picker, is the
 * separate, still-in-use consumer of `@data/icons`) — deleted outright
 * rather than kept around unused. The half-destructured
 * `useCategoryForm()` call this screen used only for
 * `selectedIcon`/`handlePressItem` is gone too: this screen is a real
 * listing/detail view now, not a category-creation form, so it has no
 * use for that hook's form state at all.
 */
export const CategoriesScreen = () => {
  const {t} = useTranslation();
  const [financeType, setFinanceType] = useState<FinanceType>('expenses');
  const navigation = useNavigation<CreateCategoryNavigationProp>();

  const {
    categories,
    categoryTotals,
    categoriesStatus,
    categoriesErrorMessage,
    reloadCategories,
    totalForPeriod,
    selectedCategoryId,
    selectCategory,
    financeItems,
    financesStatus,
    financesErrorMessage,
    reloadFinances,
    isLoadingMore,
    loadMoreFinances,
    isRefreshing,
    refresh,
  } = useCategoriesScreen(financeType);


  // `navigation` aqui es el de las pestanas Gastos/Ingresos; la ruta de
  // edicion vive en el stack de arriba, asi que se navega sin tipar el
  // destino — mismo apano pragmatico que ya usa `onPressAdd` y que
  // documenta `SiblingTabParamList` en `ResumenScreen`.
  const transactionActions = useTransactionActions({
    onEdit: financeId =>
      (navigation as any).navigate('EditTransaction', {financeId}),
    onChanged: refresh,
  });

  // El menu guarda la categoria completa, no solo su id: al confirmar el
  // borrado la lista ya se habra recargado y buscarla por id daria
  // `undefined` justo cuando hace falta su nombre para el mensaje.
  const onPressAdd = () => navigation.navigate('CreateCategory');

  /**
   * Administrar categorias ya NO vive aqui: la pulsacion larga
   * desaparecio con la rejilla, y editar/eliminar estan en el menu
   * lateral (`CategoriesAdminScreen`), igual que las cuentas. Esta
   * pestana es para RECORRER los movimientos de una categoria.
   */
  const cards = mapCategoriesToCatalogCards(categories, categoryTotals);

  /**
   * Un toque en la tarjeta de alta crea; en cualquier otra, selecciona.
   * Misma bifurcacion que `AccountsScreen.onPressCatalogItem`, porque la
   * tarjeta de "crear" viaja dentro de los mismos datos que las reales.
   */
  const onPressCatalogItem = (id: number) => {
    if (id === ADD_CATEGORY_CARD_ID) {
      onPressAdd();
      return;
    }
    selectCategory(id);
  };
  const sections = groupCategoryFinancesByDate(financeItems);
  const selectedCategory = categories.find(category => category.id === selectedCategoryId);

  return (
    <ScreenContainer>
      <ScrollContainer style={styles.scroll}>
        <View style={styles.content}>
          {/* Filtro de tipo, en CHIPS y no en un control segmentado.
              Con la anatomia del segmentado —carril claro y pastilla
              blanca a todo el ancho— quedaba identico a las pestanas
              Cuentas|Categorias que tiene justo encima, y se leia como
              una segunda fila de navegacion: exactamente el
              amontonamiento que este rediseno quitaba. Dos chips
              estrechos se leen como lo que son, un filtro del
              contenido. */}
          <View style={styles.typeFilter}>
            <ChipSelect
              value={financeType}
              onChange={setFinanceType}
              options={[
                {value: 'expenses', label: t('categories.expenses')},
                {value: 'incomes', label: t('categories.incomes')},
              ]}
            />
          </View>

          {/* Solo la leyenda del periodo y su cifra. Fuera el titulo
              ("Categorias de gastos", que la pestana ya dice) y el texto
              de ayuda: entre los dos empujaban la lista de movimientos
              por debajo del pliegue, y el objetivo de este rediseno es
              que se vean al abrir la pantalla. */}
          <View style={styles.totalBlock} accessible accessibilityRole="text">
            <Text color={colors[gray][0]} size={12}>
              {t(`categories.tabCopy.${financeType}.totalLabel`)}
            </Text>
            {categoriesStatus === 'loading' ? (
              <ActivityIndicator
                size="small"
                color={colors[gray][0]}
                accessibilityLabel={t('categories.loadingCategories')}
                style={styles.totalSpinner}
              />
            ) : (
              <Text
                color={
                  financeType === 'expenses'
                    ? colors.error[0]
                    : colors.success[0]
                }
                size={32}
                bold>
                {formatCentsToCurrency(totalForPeriod)}
              </Text>
            )}
          </View>

          {categoriesStatus === 'loading' && (
            <View style={styles.centered}>
              <ActivityIndicator
                size="large"
                color={colors[accent][2]}
                accessibilityLabel={t('categories.loadingCategories')}
              />
            </View>
          )}

          {categoriesStatus === 'error' && (
            <View style={styles.centered}>
              <Text color={colors[secondary][0]} style={styles.message}>
                {categoriesErrorMessage}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('categories.retryLoadingCategories')}
                onPress={reloadCategories}
                style={styles.retryButton}>
                <Text color={colors[white][0]}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {categoriesStatus === 'success' && (
            <>
              {/* La MISMA lista horizontal que las cuentas: las dos
                  mitades de Movimientos hacen lo mismo —elegir un
                  elemento para ver sus movimientos— asi que comparten
                  componente, incluido el aire para las sombras y el
                  desplazamiento hasta el borde. La tarjeta de alta va
                  siempre al final, tambien sin categorias, para que
                  crear la primera sea alcanzable. */}
              <CatalogList
                data={cards}
                selectedId={selectedCategoryId ?? -2}
                onPressItem={onPressCatalogItem}
              />

              {categories.length === 0 ? (
                <View style={styles.centered}>
                  <Text color={colors[gray][0]} style={styles.message}>
                    {t('categories.emptyStateForTab')}
                  </Text>
                </View>
              ) : (
                <CategoryMovementsList
                  onLongPressItem={transactionActions.open}
                  onPressSeeAll={() =>
                    (navigation as any).navigate('AllMovements', {
                      idCategory: selectedCategoryId,
                    })
                  }
                  categoryName={selectedCategory?.name}
                  sections={sections}
                  count={financeItems.length}
                  status={financesStatus}
                  errorMessage={financesErrorMessage}
                  onRetry={reloadFinances}
                  isLoadingMore={isLoadingMore}
                  onEndReached={loadMoreFinances}
                  refreshing={isRefreshing}
                  onRefresh={refresh}
                />
              )}
            </>
          )}
        </View>
      </ScrollContainer>

      <TransactionActionsDialogs {...transactionActions.dialogProps} />

    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
  },
  typeFilter: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  totalBlock: {
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  totalSpinner: {
    alignSelf: 'flex-start',
    marginVertical: 8,
  },
  content: {
    width: '100%',
    paddingBottom: 30,
  },
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
});
