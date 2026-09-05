import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import VectorIcon from 'react-native-vector-icons/FontAwesome';

import {useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faFilter} from '@fortawesome/free-solid-svg-icons/faFilter';

import {ScreenContainer} from '@components/atoms';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {TransactItem} from '@components/atoms/items/TransactItem';
import {
  TransactionActionsDialogs,
  useTransactionActions,
} from '@components/organisms/feedback';
import {accent, colors, gray, primary, secondary, white} from '@constants/colors/colors';
import {HomeNavParams} from '@navigation/[home]/HomeNavigator/types';
import {useAllMovements} from './useAllMovements';
import {FiltersSheet} from './partials/FiltersSheet';
import {TimeRange} from './mappers';

type AllMovementsScreenProps = {
  navigation: NativeStackNavigationProp<HomeNavParams, 'AllMovements'>;
  route: RouteProp<HomeNavParams, 'AllMovements'>;
};

const TIME_RANGES: TimeRange[] = ['all', 'month', 'quarter', 'year'];

/**
 * Todos los movimientos, fuera de las pestanas.
 *
 * Vive en el stack de `HomeNavigator`, por ENCIMA del navegador de
 * pestanas, asi que al abrirse cubre tambien la barra inferior: es una
 * vista de consulta a pantalla completa, no una cuarta pestana.
 *
 * Se entra desde cualquier lista de movimientos —Balance, una cuenta,
 * una categoria— y el contexto de origen llega como parametro para
 * PRE-APLICAR ese filtro: entrar desde "Efectivo" abre la lista ya
 * filtrada por Efectivo, con el chip marcado, y desde ahi se puede
 * quitar o combinar con los otros.
 */
export const AllMovementsScreen = ({navigation, route}: AllMovementsScreenProps) => {
  const {t} = useTranslation();
  const {idAccount, idCategory} = route.params ?? {};

  const {
    filters,
    setFilter,
    clearFilters,
    hasFiltersApplied,
    accounts,
    categories,
    sections,
    count,
    status,
    errorMessage,
    reload,
    loadMore,
    isLoadingMore,
    isRefreshing,
    refresh,
  } = useAllMovements({
    accountId: idAccount ?? 'all',
    categoryId: idCategory ?? 'all',
  });

  const [filtersOpen, setFiltersOpen] = useState(false);

  const transactionActions = useTransactionActions({
    // `EditTransaction` esta en ESTE stack, no en la pestana: ver el
    // comentario de la ruta en `HomeNavigator/types`.
    onEdit: financeId => navigation.navigate('EditTransaction', {financeId}),
    onChanged: refresh,
  });

  // `'all'` viaja como cadena y los ids como numero: los chips trabajan
  // con cadenas, asi que se convierte en los dos sentidos aqui y el
  // hook sigue recibiendo el id como numero.
  /**
   * Los filtros ACTIVOS, ya resueltos a etiqueta y con como quitarlos.
   * Se construye aqui y no en el hook porque son puro texto de
   * pantalla: el hook no conoce las traducciones ni el nombre visible
   * de una cuenta.
   */
  const appliedFilters: {key: string; label: string; onRemove: () => void}[] = [];
  if (filters.range !== 'all') {
    appliedFilters.push({
      key: 'range',
      label: t(`allMovements.range.${filters.range}`),
      onRemove: () => setFilter('range', 'all'),
    });
  }
  if (filters.accountId !== 'all') {
    const account = accounts.find(item => item.id === filters.accountId);
    appliedFilters.push({
      key: 'account',
      label: account?.name ?? t('allMovements.accountLabel'),
      onRemove: () => setFilter('accountId', 'all'),
    });
  }
  if (filters.categoryId !== 'all') {
    const category = categories.find(item => item.id === filters.categoryId);
    appliedFilters.push({
      key: 'category',
      label: category?.name ?? t('allMovements.categoryLabel'),
      onRemove: () => setFilter('categoryId', 'all'),
    });
  }

  const rangeOptions = TIME_RANGES.map(range => ({
    value: range,
    label: t(`allMovements.range.${range}`),
  }));
  const accountOptions = [
    {value: 'all', label: t('allMovements.allAccounts')},
    ...accounts.map(account => ({
      value: String(account.id),
      label: account.name,
    })),
  ];
  const categoryOptions = [
    {value: 'all', label: t('allMovements.allCategories')},
    ...categories.map(category => ({
      value: String(category.id),
      label: category.name,
    })),
  ];

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <VectorIcon name="chevron-left" size={22} color={colors[gray][1]} />
        </TouchableOpacity>
        <Title level={2} marginBottom={0}>
          {t('allMovements.title')}
        </Title>
      </View>

      {/* Solo los filtros YA APLICADOS, cada uno con su aspa para
          quitarlo suelto. Elegirlos se hace en la hoja: con veinte
          categorias una fila de chips es un carrusel donde encontrar
          una concreta cuesta mas que buscarla escribiendo. */}
      <View style={styles.filterBar}>
        <View style={styles.appliedRow}>
          {appliedFilters.length === 0 ? (
            <Text size={12} color={colors[gray][0]}>
              {t('allMovements.noFilters')}
            </Text>
          ) : (
            appliedFilters.map(applied => (
              <TouchableOpacity
                key={applied.key}
                accessibilityRole="button"
                accessibilityLabel={t('allMovements.removeFilter', {
                  name: applied.label,
                })}
                onPress={applied.onRemove}
                style={styles.appliedChip}>
                <Text size={12} color={colors[accent][0]}>
                  {applied.label}
                </Text>
                <VectorIcon
                  name="times"
                  size={11}
                  color={colors[accent][0]}
                  style={styles.appliedChipIcon}
                />
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('allMovements.filtersTitle')}
          onPress={() => setFiltersOpen(true)}
          style={styles.filtersButton}>
          <FontAwesomeIcon icon={faFilter} size={13} color={colors[primary][0]} />
          <Text size={12} color={colors[primary][0]} style={styles.filtersLabel}>
            {t('allMovements.filtersButton')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.countRow}>
        <Text size={12} color={colors[gray][0]}>
          {t('allMovements.count', {count})}
        </Text>
        {hasFiltersApplied && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('allMovements.clearFilters')}
            onPress={clearFilters}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text size={12} color={colors[accent][2]}>
              {t('allMovements.clearFilters')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('allMovements.loading')}
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
            accessibilityLabel={t('common.retry')}
            onPress={reload}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
          }
          ListEmptyComponent={
            <Text color={colors[gray][0]} style={styles.message}>
              {hasFiltersApplied
                ? t('allMovements.emptyFiltered')
                : t('allMovements.empty')}
            </Text>
          }
          renderSectionHeader={({section}) => (
            <View style={styles.sectionHeader}>
              <Text size={13} color={colors[gray][1]} style={styles.sectionTitle}>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({item}) => (
            <TransactItem
              {...item}
              onLongPress={
                item.id !== undefined
                  ? () => transactionActions.open(item.id as number)
                  : undefined
              }
            />
          )}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                color={colors[accent][2]}
                accessibilityLabel={t('allMovements.loadingMore')}
                style={styles.footerSpinner}
              />
            ) : null
          }
        />
      )}

      <FiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilter}
        onClear={clearFilters}
        rangeOptions={rangeOptions}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
      />

      <TransactionActionsDialogs {...transactionActions.dialogProps} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  // `width: '100%'` explicito: `ScreenContainer` centra a sus hijos, asi
  // que una fila sin ancho se encoge a su contenido y un
  // `space-between` no separa nada — es lo que dejaba el contador y
  // "Quitar filtros" pegados.
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 12,
  },
  backButton: {
    marginRight: 10,
  },
  filterBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  appliedRow: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginRight: 10,
    paddingTop: 4,
  },
  appliedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors[primary][0],
  },
  appliedChipIcon: {
    marginLeft: 6,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors[primary][0],
  },
  filtersLabel: {
    marginLeft: 8,
    fontWeight: '600',
  },
  countRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 14,
    marginBottom: 4,
  },
  list: {
    width: '100%',
  },
  // El contenido de la lista ES la tarjeta: cabeceras de mes y filas
  // van dentro de una sola superficie blanca con el mismo radio 20 y la
  // misma sombra que el resto de tarjetas de la app.
  //
  // La tarjeta se aplica al `contentContainerStyle` y no a un `View` que
  // envuelva la lista, a proposito: envolviendola, la tarjeta ocuparia
  // todo el alto disponible y con un solo movimiento quedaria una
  // superficie blanca casi vacia hasta el borde inferior. Aplicada al
  // contenido, crece y se encoge con los movimientos que haya.
  //
  // `overflow: 'hidden'` es lo que hace que el radio recorte de verdad
  // a la primera cabecera y a la ultima fila; sin el, las esquinas se
  // ven redondeadas pero los hijos siguen pintando cuadrado por encima.
  // SIN margen horizontal propio, y es deliberado: `ScreenContainer` ya
  // aplica `paddingHorizontal: 15` a todo lo que envuelve, que es la
  // misma sangria con la que se dibujan las tarjetas del resto de la
  // app. Anadir margen aqui la sumaba a esos 15 y le quitaba ancho a la
  // fila: con 12 (27 en total) `TransactItem` empezaba a cortar la linea
  // secundaria en "01 ago 2026 · Efec...". Medido en el emulador
  // comparando capturas, no el volcado de `uiautomator` — ese devuelve
  // el texto FUENTE y no delata los puntos suspensivos.
  listContent: {
    marginBottom: 40,
    // SIN padding horizontal: las filas de `TransactItem` ya reparten su
    // ancho entre icono, concepto e importe, y quitarles 16 mas partia
    // "Alquiler de casa" en "Alquiler de ...". La sangria de la tarjeta
    // la da su margen; el aire interior, el propio `marginVertical` de
    // cada fila.
    paddingBottom: 8,
    backgroundColor: colors[white][0],
    borderRadius: 20,
    overflow: 'hidden',
    // `boxShadow` y no `elevation`: en Android la sombra de `elevation`
    // sigue el contorno RECTANGULAR de la vista y asomaria por las
    // cuatro esquinas como un cuadrado gris.
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.10)',
  },
  // Fondo opaco: la cabecera queda fija y sin el se veria pasar las
  // filas por debajo. `#FAFAFA` sobre el blanco de la tarjeta se lee
  // como una banda de grupo muy tenue, no como un bloque gris pegado.
  sectionHeader: {
    backgroundColor: colors.surface[0],
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontWeight: '700',
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
  footerSpinner: {
    marginVertical: 16,
  },
});

export default AllMovementsScreen;
