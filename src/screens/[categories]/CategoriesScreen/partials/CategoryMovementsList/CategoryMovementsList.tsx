import {FC} from 'react';
import {ActivityIndicator, SectionList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {TransactItem} from '@components/atoms/items/TransactItem';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {LoadStatus} from '@hooks/useCategoriesScreen';
import {useTranslation} from 'react-i18next';

interface CategoryMovementsListProps {
  /** Selected category's display name, for the empty-state message. */
  categoryName?: string;
  sections: SectionTransactItem[];
  /** Pulsacion larga sobre una fila: administrar el movimiento. */
  onLongPressItem?: (financeId: number) => void;
  /** "Ver todos": abre la pantalla de todos los movimientos, ya
   * filtrada por esta categoria. */
  onPressSeeAll?: () => void;
  /** Rows currently loaded (grows as `onEndReached` pages in more) — not
   * a total row count from the DB (`@db/queries` exposes no such
   * count), so this reads as "N movements loaded so far", not
   * "N movements exist total". */
  count: number;
  status: LoadStatus;
  errorMessage: string;
  onRetry: () => void;
  isLoadingMore?: boolean;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * The selected category's movement history — "la lista de movimientos
 * de la categoría seleccionada con su conteo" from the approved
 * prototype. Same keyset-pagination wiring as `TransactList`
 * (`onEndReached`/`isLoadingMore`/`refreshing`/`onRefresh` all threaded
 * straight to `SectionList`, left SCROLL-ENABLED so `onEndReached` still
 * fires nested inside the screen's outer `ScrollContainer` — same
 * composition `AccountsScreen`'s `TransactList` already runs this way),
 * re-implemented locally (not imported) rather than reusing that
 * organism as-is: `TransactList` hard-codes a bare "Transactions"
 * header and has no loading/error/empty states of its own (those live
 * one level up, in `FragmentSection`, which is `AccountsScreen`-shaped
 * specifically) — this component folds the count and all four
 * lifecycle states into one place instead of the same split.
 */
export const CategoryMovementsList: FC<CategoryMovementsListProps> = ({
  categoryName,
  onLongPressItem,
  onPressSeeAll,
  sections,
  count,
  status,
  errorMessage,
  onRetry,
  isLoadingMore = false,
  onEndReached,
  refreshing,
  onRefresh,
}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Title level={2} style={styles.title}>
          {t('categories.movementsHeading')}
        </Title>
        {status === 'success' && (
          <View style={styles.headerRight}>
            <Text color={colors[gray][0]} size={12}>
              {t('categories.movementsCount', {count})}
            </Text>
            {onPressSeeAll && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('allMovements.seeAll')}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={onPressSeeAll}
                style={styles.seeAll}>
                <Text color={colors[accent][2]} size={12}>
                  {t('allMovements.seeAll')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('categories.loadingMovements')}
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
            accessibilityLabel={t('categories.retryLoadingMovements')}
            onPress={onRetry}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && sections.length === 0 && (
        <View style={styles.centered}>
          <Text color={colors[gray][0]} style={styles.message}>
            {categoryName
              ? t('categories.noMovementsForCategory', {name: categoryName})
              : t('categories.noMovementsGeneric')}
          </Text>
        </View>
      )}

      {status === 'success' && sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            item.id !== undefined ? String(item.id) : `${item.category}-${index}`
          }
          renderItem={({item}) => (
            <TransactItem
              {...item}
              onLongPress={
                onLongPressItem && item.id !== undefined
                  ? () => onLongPressItem(item.id as number)
                  : undefined
              }
            />
          )}
          renderSectionHeader={({section: {date}}) => (
            <Title level={3} style={styles.sectionTitle}>
              {date}
            </Title>
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                style={styles.footerSpinner}
                size="small"
                color={colors[accent][2]}
                accessibilityLabel={t('categories.loadingMoreMovements')}
              />
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  seeAll: {
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    marginBottom: 0,
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  message: {
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
  sectionTitle: {
    color: '#A09FAE',
    marginTop: 20,
  },
  footerSpinner: {
    marginVertical: 15,
  },
});

export default CategoryMovementsList;
