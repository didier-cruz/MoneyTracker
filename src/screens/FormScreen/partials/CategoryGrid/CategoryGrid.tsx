import {colors, gray, primary, white} from '@constants/colors/colors';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';

type Props = {
  title: string;
  countLabel: string;
  categories: ICategory[];
  selectedCategory: ICategory | undefined;
  onSelectCategory: (category: ICategory) => void;
  /** Abre la pantalla de administrar categorias. Es el ultimo elemento
   * de la grilla: crear una categoria se pide justo cuando falta una
   * mientras se registra el movimiento. */
  onPressManageCategories: () => void;
};

// The prototype's default ink color for everything NOT explicitly
// re-colored (title, "Categoría" heading, unselected tile icon/label,
// and the selected tile's own background) — same `#373737` already
// used ad hoc in `ArchivedAccounts.tsx`, no dedicated token exists for
// it in `@constants/colors`.
const INK = '#373737';

/**
 * The category grid from the approved prototype: 3 columns of 96px/
 * radius-15 tiles inside a white, radius-20 card, the selected tile
 * filled solid `#373737` with white icon/label.
 *
 * Rendered with `.map()`, not `FlatList` — this app seeds ~11
 * categories total, so a single type's filtered list is always small
 * (a handful of tiles) and fully on-screen already; it's not a long or
 * paginated list, and nesting a `FlatList` inside this screen's own
 * `ScrollView` would trip the "VirtualizedLists should never be nested
 * inside plain ScrollViews" warning for no benefit.
 */
const CategoryGrid = ({
  title,
  countLabel,
  categories,
  selectedCategory,
  onSelectCategory,
  onPressManageCategories,
}: Props) => {
  const {t} = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{countLabel}</Text>
      </View>

      <View style={styles.grid}>
        {categories.map(category => {
          const {id, icon, name} = category;
          const isSelected = selectedCategory?.id === id;
          return (
            <TouchableOpacity
              key={id}
              accessibilityRole="button"
              accessibilityLabel={t(
                'form.selectCategoryAccessibilityLabel',
                {name},
              )}
              accessibilityState={{selected: isSelected}}
              style={[styles.tile, isSelected && styles.tileSelected]}
              onPress={() => onSelectCategory(category)}>
              <Icon
                name={icon}
                size={28}
                color={isSelected ? colors[white][0] : INK}
              />
              <Text style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('form.manageCategories')}
          style={[styles.tile, styles.tileAdd]}
          onPress={onPressManageCategories}>
          <Icon name="plus" size={24} color={colors[primary][0]} />
          <Text style={[styles.tileLabel, styles.tileLabelAdd]}>
            {t('form.manageCategories')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tileAdd: {
    borderWidth: 1.5,
    borderColor: colors[primary][0],
    borderStyle: 'dashed',
  },
  tileLabelAdd: {
    color: colors[primary][0],
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: INK,
  },
  count: {
    fontSize: 13,
    color: colors[gray][0],
  },
  grid: {
    width: '100%',
    backgroundColor: colors[white][0],
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    shadowColor: 'black',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  tile: {
    // 3 columns with a 6px gap on both axes: each tile is a third of
    // the row width minus its share of the two inter-column gaps.
    width: '31.4%',
    height: 96,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileSelected: {
    backgroundColor: INK,
  },
  tileLabel: {
    fontSize: 12,
    color: INK,
    textAlign: 'center',
  },
  tileLabelSelected: {
    color: colors[white][0],
  },
});

export default CategoryGrid;
