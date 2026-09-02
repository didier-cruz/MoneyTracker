import {FC} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {colors, white} from '@constants/colors/colors';
import {CategoryTile} from './CategoryTile';
import {ADD_CATEGORY_TILE_ID, ICategoryTile} from '../../mappers';

interface CategoryGridProps {
  tiles: ICategoryTile[];
  selectedId?: number;
  onPressCategory: (id: number) => void;
  onPressAdd: () => void;
  /** Pulsacion larga sobre una categoria real — abre administrar. */
  onLongPressCategory: (id: number) => void;
}

/**
 * The "tarjeta con grilla de 3 columnas" from the approved prototype:
 * one rounded/elevated card (same idiom as `CategoryLimitsSection`'s
 * `.card`) holding a 3-column grid of `CategoryTile`s, always ending in
 * the dashed "New" tile.
 *
 * `scrollEnabled={false}`: this grid never needs its OWN scroll/
 * pagination (the category list is small and `getCategoriesByType`
 * returns it in one shot, unlike the paginated movements list below it
 * on the screen) — it is laid out once, in full, inside the screen's
 * outer vertical scroll. Deliberately NOT mirroring
 * `TransactList`/`CategoryMovementsList`'s SectionList (which DOES stay
 * scroll-enabled, since IT needs `onEndReached` to fire): a second,
 * independently-scrolling VERTICAL list nested in the same outer
 * scroller has no upside here and is the classic nested-VirtualizedList
 * footgun, so this sidesteps it entirely rather than relying on
 * `react-native-virtualized-view`'s outer `ScrollView` to reconcile it.
 */
export const CategoryGrid: FC<CategoryGridProps> = ({
  tiles,
  selectedId,
  onPressCategory,
  onPressAdd,
  onLongPressCategory,
}) => {
  return (
    <View style={styles.card}>
      <FlatList
        data={tiles}
        keyExtractor={item => item.id.toString()}
        numColumns={3}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
        renderItem={({item}) => (
          <CategoryTile
            tile={item}
            isSelected={item.id === selectedId}
            onPress={() =>
              item.id === ADD_CATEGORY_TILE_ID ? onPressAdd() : onPressCategory(item.id)
            }
            onLongPress={
              item.id === ADD_CATEGORY_TILE_ID
                ? undefined
                : () => onLongPressCategory(item.id)
            }
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors[white][0],
    elevation: 4,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});

export default CategoryGrid;
