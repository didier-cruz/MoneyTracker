import {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation, useTheme} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import VectorIcon from 'react-native-vector-icons/FontAwesome';

import {ScreenContainer} from '@components/atoms';
import {Text} from '@components/atoms/text/Text';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {getDbConnection} from '@db/db';
import {deleteCategory, getCategories, getCategoryUsage} from '@db/queries';
import {accent, colors, gray, inactive, primary, secondary, white} from '@constants/colors/colors';
import {EntityMovementsPanel} from '@components/organisms/Lists/EntityMovementsPanel';
import {TextInput} from 'react-native';
import {
  QuickReturnHeader,
  useQuickReturnHeader,
} from '@components/molecules/Headers/QuickReturnHeader';
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
  /**
   * El fondo de pantalla lo pinta el tema de React Navigation
   * (`#F2F2F2` en el claro), no `@constants/colors`. La cabecera de
   * seccion fija lo necesita OPACO —si no, las filas se ven pasar por
   * debajo— y se lee de aqui en vez de copiar el literal, que se
   * desincronizaria en cuanto alguien cambie el tema.
   */
  const {colors: navColors} = useTheme();

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // Con el buscador en uso la cabecera no se retira: esconder un campo
  // enfocado mientras se escribe deja al usuario tecleando a ciegas.
  const quickReturn = useQuickReturnHeader({
    locked: isSearchFocused || query.length > 0,
  });
  /** Una sola fila abierta a la vez: cada despliegue lanza su propia
   * consulta de movimientos, y permitir varias abiertas seria volver al
   * patron de "una consulta por elemento" que este proyecto ya tiene
   * anotado como algo que no repetir. */
  const [expandedId, setExpandedId] = useState<number>();
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

  // La busqueda normaliza acentos por los dos lados: escribir
  // "educacion" tiene que encontrar "Educación", que es como se llama la
  // categoria que siembra la app por defecto.
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const needle = normalize(query.trim());
  const visible =
    needle.length === 0
      ? categories
      : categories.filter(category => normalize(category.name).includes(needle));

  const sections = [
    {
      key: 'expense',
      title: t('categories.expenses'),
      data: visible.filter(category => category.type === 'expense'),
    },
    {
      key: 'income',
      title: t('categories.incomes'),
      data: visible.filter(category => category.type === 'income'),
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
    <ScreenContainer containerStyle={styles.screen}>
      {/* `MainHeader` (boton del menu lateral) y no el `Header` de
          categorias (flecha de volver): esta pantalla es una RAIZ del
          menu lateral, asi que una flecha de volver no tendria destino
          — otro control muerto como los que ya hemos ido quitando. */}
      {/* `title` + `subtitle` por separado y NO el titulo largo entero:
          `MainHeader` parte `title` por el primer espacio y descarta lo
          que venga despues de la segunda palabra —lo avisa su propio
          comentario—, asi que "Listado de Categorias y sus Movimientos"
          se quedaba en "Listado / de". Verificado en el emulador. En dos
          lineas cabe y ademas encaja con el resto de cabeceras de la app
          ("Balance / Resumen", "Presupuestos / septiembre"). */}
      <MainHeader
        title={t('categories.adminHeaderTitle')}
        subtitle={t('categories.adminHeaderSubtitle')}
      />
      <QuickReturnHeader controller={quickReturn}>
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <VectorIcon name="search" size={14} color={colors[gray][0]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('entityPicker.searchCategory')}
            placeholderTextColor={colors[gray][0]}
            style={styles.searchInput}
            autoCorrect={false}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            accessibilityLabel={t('entityPicker.searchCategory')}
          />
          {query.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={() => setQuery('')}>
              <VectorIcon name="times-circle" size={16} color={colors[gray][0]} />
            </TouchableOpacity>
          )}
        </View>

        {/* El acceso a crear va ARRIBA, no al pie de la lista: con 19
            categorias —y mas ahora que cada fila se despliega con sus
            movimientos— al pie quedaba a varias pantallas de scroll, que
            es tanto como no estar. Mismo cambio que en cuentas. */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('categories.createNewCategory')}
          onPress={() => navigation.navigate('CreateCategory')}
          style={[styles.addRow, styles.addRowTop]}>
          <VectorIcon name="plus" color={colors[primary][0]} size={16} />
          <Text color={colors[primary][0]} style={styles.addLabel}>
            {t('categories.adminAddCategory')}
          </Text>
        </TouchableOpacity>
      </View>
      </QuickReturnHeader>

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
          // En iOS viene activado por defecto pero en Android NO, asi que
          // sin esta linea las cabeceras se iban con el scroll justo en
          // la plataforma donde se prueba esta app.
          stickySectionHeadersEnabled
          onScroll={quickReturn.onScroll}
          onContentSizeChange={quickReturn.onContentSizeChange}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <Text color={colors[gray][0]} style={styles.message}>
              {t('categories.adminEmptyState')}
            </Text>
          }
          renderSectionHeader={({section}) => (
            <View style={[styles.sectionHeader, {backgroundColor: navColors.background}]}>
              <Text size={12} color={colors[gray][0]} style={styles.sectionTitle}>
                {section.title.toUpperCase()}
              </Text>
            </View>
          )}
          renderItem={({item}) => {
            const isExpanded = expandedId === item.id;
            return (
              <>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{expanded: isExpanded}}
              accessibilityLabel={t('categories.toggleMovementsAccessibilityLabel', {
                name: item.name,
              })}
              onPress={() => setExpandedId(prev => (prev === item.id ? undefined : item.id))}
              style={styles.row}>
              <View style={styles.icon}>
                <VectorIcon name={item.icon} color={colors[white][0]} size={14} />
              </View>
              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>
              <VectorIcon
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                color={colors[gray][0]}
                size={12}
              />
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
            </TouchableOpacity>
            {isExpanded && <EntityMovementsPanel idCategory={item.id} />}
              </>
            );
          }}
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
  addRowTop: {
    marginTop: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface[0],
    borderWidth: 1,
    borderColor: colors.inactive[0],
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
    color: colors[gray][1],
  },
  header: {
    // `width: '100%'` explicito: `ScreenContainer` centra a sus hijos,
    // asi que una fila sin ancho se encoge a su contenido — el buscador
    // quedaba reducido a un cuadradito con la lupa. Mismo caso que ya
    // documenta `AllMovementsScreen`.
    width: '100%',
    // Sin sangria propia: `ScreenContainer` ya aplica 15 a todo lo que
    // envuelve. Los 15 de aqui se SUMABAN a esos, dejando 30 por lado y
    // estrechando la lista sin motivo.
    marginBottom: 8,
  },
  screen: {
    // `paddingBottom: 0` anula los 32 que `ScreenContainer` pone a todo
    // lo que envuelve. Esos 32 quedaban FUERA de la lista: un hueco
    // muerto bajo el area desplazable, que recortaba el alto util sin
    // dar aire al final del contenido. El mismo espacio vive ahora
    // DENTRO, en `listContent`, donde si se desplaza con las filas y
    // solo se ve al llegar al final.
    //
    // Aqui es seguro quitarlos: esos 32 existen en `ScreenContainer`
    // para que el ultimo elemento no quede bajo el FAB, y estas
    // pantallas cuelgan del menu lateral, fuera del navegador de
    // pestanas que lo dibuja.
    paddingBottom: 0,
    // `flex: 1` en el contenedor y en la lista.
    //
    // `ScreenContainer` NO acota su alto —no lleva `flex: 1`, y lo usan
    // otras 13 pantallas, asi que no se le pone alli—, de modo que
    // crecia hasta lo que midiera la lista y el final se salia de la
    // pantalla: el ultimo elemento quedaba cortado y el scroll ya no
    // podia traerlo, porque para la lista ya estaba en su tope. Medido:
    // la ultima fila se dibujaba de 2202 a 2274 cuando mide 169.
    flex: 1,
  },
  list: {
    width: '100%',
    flex: 1,
  },
  listContent: {
    // Sin sangria propia: `ScreenContainer` ya aplica 15 a todo lo que
    // envuelve. Los 15 de aqui se SUMABAN a esos, dejando 30 por lado y
    // estrechando la lista sin motivo.
    paddingBottom: 72,
  },
  sectionHeader: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionTitle: {
    letterSpacing: 1,
    fontWeight: '700',
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
