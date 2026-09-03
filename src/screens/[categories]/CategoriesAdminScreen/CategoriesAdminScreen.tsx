import {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import VectorIcon from 'react-native-vector-icons/FontAwesome';

import {ScreenContainer} from '@components/atoms';
import {Text} from '@components/atoms/text/Text';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {getDbConnection} from '@db/db';
import {deleteCategory, getCategories, getCategoryUsage} from '@db/queries';
import {accent, colors, gray, inactive, primary, secondary, white} from '@constants/colors/colors';
import {MainHeader} from '@components/molecules/Headers/MainHeader';
import {CategoriesAdminNavigationProp} from '@navigation/[categories]/CategoriesAdminNavigator/types';

type Status = 'loading' | 'success' | 'error';

type DeleteState = {
  visible: boolean;
  category?: ICategory;
  movements: number;
  budgets: number;
};

/**
 * Administrar categorias: listarlas, crearlas, editarlas y borrarlas.
 *
 * Es la opcion 2 del menu lateral y NO muestra movimientos a proposito:
 * recorrer los movimientos de una categoria es lo que hace la pestana
 * Categorias de Movimientos. Aqui la pregunta es otra —"que categorias
 * tengo y como las cambio"— asi que la pantalla es una lista plana,
 * agrupada por tipo, con las acciones a la vista en cada fila en vez de
 * escondidas tras una pulsacion larga: en una pantalla cuyo unico
 * proposito es administrar, esconder las acciones no tiene sentido.
 */
export const CategoriesAdminScreen = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<CategoriesAdminNavigationProp>();
  const {notice, showNotice, dismissNotice} = useNoticeDialog();

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteState, setDeleteState] = useState<DeleteState>({
    visible: false,
    movements: 0,
    budgets: 0,
  });

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const db = await getDbConnection();
      setCategories(await getCategories(db));
      setStatus('success');
    } catch (e: any) {
      setErrorMessage(
        t('categories.loadCategoriesError', {
          message: e?.message ?? t('common.unknownError'),
        }),
      );
      setStatus('error');
    }
  }, [t]);

  // Al recuperar el foco: se vuelve aqui tras crear o editar y la lista
  // tiene que reflejarlo. Mismo motivo que en el resto de la app.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sections = [
    {
      key: 'expense',
      title: t('categories.expenses'),
      data: categories.filter(category => category.type === 'expense'),
    },
    {
      key: 'income',
      title: t('categories.incomes'),
      data: categories.filter(category => category.type === 'income'),
    },
  ].filter(section => section.data.length > 0);

  const onPressDelete = async (category: ICategory) => {
    const usage = await getDbConnection().then(db =>
      getCategoryUsage(db, category.id),
    );
    setDeleteState({visible: true, category, ...usage});
  };

  const closeDelete = () => setDeleteState(prev => ({...prev, visible: false}));

  const onConfirmDelete = async () => {
    const category = deleteState.category;
    if (!category) {
      return;
    }
    closeDelete();
    try {
      const db = await getDbConnection();
      await deleteCategory(db, category.id);
      await load();
    } catch {
      showNotice('danger', t('common.error'), t('categories.deleteCategoryError'));
    }
  };

  const deleteMessage = (): string => {
    const {category, movements, budgets} = deleteState;
    if (!category) {
      return '';
    }
    if (budgets > 0) {
      return t('categories.deleteCategoryWithBudgets', {
        name: category.name,
        count: movements,
      });
    }
    if (movements > 0) {
      return t('categories.deleteCategoryWithMovements', {
        name: category.name,
        count: movements,
      });
    }
    return t('categories.deleteCategoryPlain', {name: category.name});
  };

  return (
    <ScreenContainer>
      {/* `MainHeader` (boton del menu lateral) y no el `Header` de
          categorias (flecha de volver): esta pantalla es una RAIZ del
          menu lateral, asi que una flecha de volver no tendria destino
          — otro control muerto como los que ya hemos ido quitando. */}
      <MainHeader title={t('categories.adminTitle')} />
      <View style={styles.header}>
        <Text color={colors[gray][0]}>{t('categories.adminMessage')}</Text>
      </View>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('categories.loadingCategories')}
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
            accessibilityLabel={t('categories.retryLoadingCategories')}
            onPress={load}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text color={colors[gray][0]} style={styles.message}>
              {t('categories.adminEmptyState')}
            </Text>
          }
          renderSectionHeader={({section}) => (
            <Text size={12} color={colors[gray][0]} style={styles.sectionTitle}>
              {section.title.toUpperCase()}
            </Text>
          )}
          renderItem={({item}) => (
            <View style={styles.row}>
              <View style={styles.icon}>
                <VectorIcon name={item.icon} color={colors[white][0]} size={14} />
              </View>
              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('categories.editCategoryAccessibilityLabel', {
                  name: item.name,
                })}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={() =>
                  navigation.navigate('EditCategory', {categoryId: item.id})
                }
                style={styles.action}>
                <VectorIcon name="pencil" color={colors[gray][0]} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('categories.deleteCategoryAccessibilityLabel', {
                  name: item.name,
                })}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={() => onPressDelete(item)}
                style={styles.action}>
                <VectorIcon name="trash-o" color={colors[gray][0]} size={18} />
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('categories.createNewCategory')}
              onPress={() => navigation.navigate('CreateCategory')}
              style={styles.addRow}>
              <VectorIcon name="plus" color={colors[primary][0]} size={16} />
              <Text color={colors[primary][0]} style={styles.addLabel}>
                {t('categories.adminAddCategory')}
              </Text>
            </TouchableOpacity>
          }
        />
      )}

      <ConfirmDialog
        visible={deleteState.visible}
        tone="danger"
        title={t('categories.deleteCategoryTitle')}
        message={deleteMessage()}
        onRequestClose={closeDelete}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={closeDelete}
        primaryLabel={t('categories.delete')}
        destructive
        onPrimaryPress={onConfirmDelete}
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 15,
    marginBottom: 4,
  },
  list: {
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  sectionTitle: {
    letterSpacing: 1,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors[white][0],
    marginBottom: 8,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors[primary][0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  name: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  action: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 30,
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors[inactive][0],
  },
  addLabel: {
    marginLeft: 8,
    fontWeight: '600',
  },
});

export default CategoriesAdminScreen;
