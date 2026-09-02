import React, {useState} from 'react';
import {faPen} from '@fortawesome/free-solid-svg-icons/faPen';
import {faTrash} from '@fortawesome/free-solid-svg-icons/faTrash';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {ScreenContainer, ScrollContainer} from '@components/atoms';
import {useNavigation} from '@react-navigation/native';
import {MaterialTopTabScreenProps} from '@react-navigation/material-top-tabs';
import {CategoriesTopTabsNavigatorParams} from '@navigation/[categories]/CategoriesTopTabsNavigator/types';
import {CreateCategoryNavigationProp} from '@navigation/[categories]/CategoriesNavigator/types';
import {useCategoriesScreen} from '@hooks/useCategoriesScreen';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {
  ActionSheet,
  ConfirmDialog,
  TransactionActionsDialogs,
  useTransactionActions,
} from '@components/organisms/feedback';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {CategoriesHeader, CategoryGrid, CategoryMovementsList} from './partials';
import {groupCategoryFinancesByDate, mapCategoriesToTiles} from './mappers';
import {useTranslation} from 'react-i18next';

interface CategoriesScreenProps
  extends MaterialTopTabScreenProps<
    CategoriesTopTabsNavigatorParams,
    'Expenses' | 'Incomes'
  > {}

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
export const CategoriesScreen = ({route}: CategoriesScreenProps) => {
  const {t} = useTranslation();
  const {financeType} = route.params;
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
    fetchCategoryUsage,
    deleteCategoryById,
  } = useCategoriesScreen(financeType);

  const {notice, showNotice, dismissNotice} = useNoticeDialog();

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
  const [manageMenu, setManageMenu] = useState<{
    visible: boolean;
    category?: ICategory;
  }>({visible: false});
  const [deleteConfirm, setDeleteConfirm] = useState<{
    visible: boolean;
    category?: ICategory;
    movements: number;
    budgets: number;
  }>({visible: false, movements: 0, budgets: 0});

  const menuCategory = manageMenu.category;
  const confirmCategory = deleteConfirm.category;

  const closeManageMenu = () => setManageMenu(prev => ({...prev, visible: false}));
  const closeDeleteConfirm = () =>
    setDeleteConfirm(prev => ({...prev, visible: false}));

  const onPressAdd = () => navigation.navigate('CreateCategory');

  const onLongPressCategory = (categoryId: number) => {
    const category = categories.find(item => item.id === categoryId);
    if (category) {
      setManageMenu({visible: true, category});
    }
  };

  const onPressEdit = () => {
    if (!menuCategory) {
      return;
    }
    closeManageMenu();
    navigation.navigate('EditCategory', {categoryId: menuCategory.id});
  };

  // Se consulta el uso ANTES de abrir la confirmacion para poder decir
  // cuantos movimientos hay en juego. El menu se cierra primero y la
  // confirmacion se abre despues del `await`, con el retardo que
  // documenta `MODAL_CHAIN_DELAY_MS`: encadenar dos modales sin pausa en
  // Android deja el segundo sin aparecer.
  const onPressDelete = async () => {
    if (!menuCategory) {
      return;
    }
    const category = menuCategory;
    closeManageMenu();
    const usage = await fetchCategoryUsage(category.id);
    setDeleteConfirm({visible: true, category, ...usage});
  };

  const onConfirmDelete = async () => {
    if (!confirmCategory) {
      return;
    }
    closeDeleteConfirm();
    const success = await deleteCategoryById(confirmCategory.id);
    if (!success) {
      showNotice('danger', t('common.error'), t('categories.deleteCategoryError'));
    }
  };

  const deleteMessage = (): string => {
    if (!confirmCategory) {
      return '';
    }
    const {movements, budgets} = deleteConfirm;
    if (budgets > 0) {
      return t('categories.deleteCategoryWithBudgets', {
        name: confirmCategory.name,
        count: movements,
      });
    }
    if (movements > 0) {
      return t('categories.deleteCategoryWithMovements', {
        name: confirmCategory.name,
        count: movements,
      });
    }
    return t('categories.deleteCategoryPlain', {name: confirmCategory.name});
  };

  const tiles = mapCategoriesToTiles(categories, categoryTotals);
  const sections = groupCategoryFinancesByDate(financeItems);
  const selectedCategory = categories.find(category => category.id === selectedCategoryId);

  return (
    <ScreenContainer>
      <ScrollContainer style={styles.scroll}>
        <View style={styles.content}>
          <CategoriesHeader
            financeType={financeType}
            totalForPeriod={totalForPeriod}
            status={categoriesStatus}
          />

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
              {/* The grid always renders (even with zero real categories
                  for this type) so its trailing "New" tile — the only way
                  to create a category from this screen — is always
                  reachable; see `mapCategoriesToTiles`'s doc comment. Not
                  from an approved prototype for the zero-categories case
                  specifically, flagged for review. */}
              <CategoryGrid
                tiles={tiles}
                selectedId={selectedCategoryId}
                onPressCategory={selectCategory}
                onPressAdd={onPressAdd}
                onLongPressCategory={onLongPressCategory}
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

      <ActionSheet
        visible={manageMenu.visible}
        onClose={closeManageMenu}
        title={
          menuCategory ? t('categories.manageCategory', {name: menuCategory.name}) : ''
        }
        actions={[
          {
            key: 'edit',
            label: t('categories.edit'),
            icon: faPen,
            onPress: onPressEdit,
          },
          {
            key: 'delete',
            label: t('categories.delete'),
            icon: faTrash,
            tone: 'destructive',
            onPress: onPressDelete,
          },
        ]}
      />

      <ConfirmDialog
        visible={deleteConfirm.visible}
        tone="danger"
        title={t('categories.deleteCategoryTitle')}
        message={deleteMessage()}
        onRequestClose={closeDeleteConfirm}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={closeDeleteConfirm}
        primaryLabel={t('categories.delete')}
        destructive
        onPrimaryPress={onConfirmDelete}
      />

      <TransactionActionsDialogs {...transactionActions.dialogProps} />

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={dismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={dismissNotice}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
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
