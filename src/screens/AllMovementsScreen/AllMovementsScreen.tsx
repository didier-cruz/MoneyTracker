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

import {ScreenContainer} from '@components/atoms';
import {ChipSelect} from '@components/atoms/ChipSelect';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {TransactItem} from '@components/atoms/items/TransactItem';
import {
  TransactionActionsDialogs,
  useTransactionActions,
} from '@components/organisms/feedback';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {HomeNavParams} from '@navigation/[home]/HomeNavigator/types';
import {useAllMovements} from './useAllMovements';
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

  const transactionActions = useTransactionActions({
    onEdit: financeId =>
      (navigation as any).navigate('Outcomes', {
        screen: 'EditTransaction',
        params: {financeId},
      }),
    onChanged: refresh,
  });

  // `'all'` viaja como cadena y los ids como numero: los chips trabajan
  // con cadenas, asi que se convierte en los dos sentidos aqui y el
  // hook sigue recibiendo el id como numero.
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

      <View style={styles.filters}>
        <ChipSelect
          scrollable
          label={t('allMovements.periodLabel')}
          value={filters.range}
          onChange={value => setFilter('range', value as TimeRange)}
          options={TIME_RANGES.map(range => ({
            value: range,
            label: t(`allMovements.range.${range}`),
          }))}
        />
        <View style={styles.filterGap} />
        <ChipSelect
          scrollable
          label={t('allMovements.accountLabel')}
          value={String(filters.accountId)}
          onChange={value =>
            setFilter('accountId', value === 'all' ? 'all' : Number(value))
          }
          options={accountOptions}
        />
        <View style={styles.filterGap} />
        <ChipSelect
          scrollable
          label={t('allMovements.categoryLabel')}
          value={String(filters.categoryId)}
          onChange={value =>
            setFilter('categoryId', value === 'all' ? 'all' : Number(value))
          }
          options={categoryOptions}
        />
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
  filters: {
    width: '100%',
    paddingHorizontal: 15,
  },
  filterGap: {
    height: 10,
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
  listContent: {
    paddingBottom: 40,
  },
  // Fondo opaco: la cabecera queda fija y sin el se veria pasar las
  // filas por debajo.
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
