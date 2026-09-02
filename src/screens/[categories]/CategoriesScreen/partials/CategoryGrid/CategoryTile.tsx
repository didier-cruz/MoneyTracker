import {FC} from 'react';
import {StyleSheet, TouchableOpacity} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {accent, colors, gray, primary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {ICategoryTile} from '../../mappers';
import {useTranslation} from 'react-i18next';

interface CategoryTileProps {
  tile: ICategoryTile;
  isSelected: boolean;
  onPress: () => void;
  /**
   * Abre el menu de administrar (editar / eliminar). Va en la pulsacion
   * LARGA y no en un boton "..." como en las tarjetas de cuenta: esta
   * casilla mide 104px e incrustarle un boton de 34 se comeria un tercio
   * del ancho. La pista esta en el texto de cabecera de la pantalla.
   */
  onLongPress?: () => void;
}

/**
 * One 104x104 grid cell — a real category (icon/name/period amount,
 * selectable) or the trailing dashed "New" affordance (see
 * `ICategoryTile.isAdd`). Selected state per the approved prototype:
 * dark (`primary`) fill, lime (`accent[0]`) icon/name — `accent[1]`
 * (a slightly deeper lime) for the amount line specifically, so the
 * name still reads as the primary label and the amount as secondary,
 * same hierarchy the unselected state already has via `gray[1]`/`gray[0]`.
 */
export const CategoryTile: FC<CategoryTileProps> = ({
  tile,
  isSelected,
  onPress,
  onLongPress,
}) => {
  const {t} = useTranslation();
  const {icon, name, amount, isAdd} = tile;

  if (isAdd) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('categories.createNewCategory')}
        accessibilityHint={t('categories.createNewCategoryHint')}
        hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.tile, styles.addTile]}>
        <VectorIcon name="plus" color={colors[primary][0]} size={24} />
        <Text color={colors[primary][0]} size={12} style={styles.name}>
          {name}
        </Text>
      </TouchableOpacity>
    );
  }

  const iconColor = isSelected ? colors[accent][0] : colors[primary][0];
  const nameColor = isSelected ? colors[accent][0] : colors[gray][1];
  const amountColor = isSelected ? colors[accent][1] : colors[gray][0];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('categories.tileAccessibilityLabel', {
        name,
        amount: formatCentsToCurrency(amount),
      })}
      accessibilityState={{selected: isSelected}}
      accessibilityHint={t('categories.tileAccessibilityHint')}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.8}
      style={[styles.tile, isSelected ? styles.tileSelected : styles.tileDefault]}>
      <VectorIcon name={icon} color={iconColor} size={30} />
      <Text lines={1} color={nameColor} size={12} style={styles.name}>
        {name}
      </Text>
      <Text lines={1} color={amountColor} size={11}>
        {formatCentsToCurrency(amount)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: {
    width: 104,
    height: 104,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tileDefault: {
    backgroundColor: colors[white][0],
  },
  tileSelected: {
    backgroundColor: colors[primary][0],
  },
  addTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors[primary][0],
    backgroundColor: 'transparent',
  },
  name: {
    marginTop: 6,
    marginBottom: 2,
    textAlign: 'center',
  },
});

export default CategoryTile;
