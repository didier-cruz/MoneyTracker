import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';

import {Text} from '@components/atoms/text/Text';
import {accent, colors, gray, primary} from '@constants/colors/colors';
import {ChipSelectProps} from './types';

// Mismo neutro de una sola vez que usan `SegmentedControl` y
// `TypeSegment` para su fondo inactivo. No esta en `@constants/colors`
// porque solo lo piden estos controles.
const CHIP_BG = '#EDEDF2';

/**
 * Elegir UNA opcion entre varias, en chips.
 *
 * Complementa a `SegmentedControl` en vez de sustituirlo: el control
 * segmentado funciona bien con DOS opciones que se leen como extremos
 * de un mismo eje (Gasto/Ingreso, Fondo/Deuda), pero con cuatro se
 * parte en una rejilla 2x2 que ya no se lee como un control, sino como
 * cuatro botones sueltos con un fondo compartido. Los chips envuelven
 * de forma natural, ocupan solo lo que mide su texto y no prometen un
 * orden que no existe.
 *
 * El estado elegido se pinta en indigo solido con texto blanco, el
 * mismo tratamiento que `CategoryTile` da a la categoria seleccionada
 * —el caso mas parecido que ya existe en la app: elegir una de N sobre
 * una superficie clara—.
 */
export const ChipSelect = <T extends string>({
  value,
  onChange,
  options,
  label,
  scrollable = false,
  testID,
}: ChipSelectProps<T>) => {
  const Row: any = scrollable ? ScrollView : View;
  const rowProps = scrollable
    ? {
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        contentContainerStyle: styles.scrollRow,
      }
    : {style: styles.row};

  return (
  <View style={styles.container} testID={testID}>
    {label !== undefined && (
      <Text size={12} color={colors[gray][0]} style={styles.label}>
        {label}
      </Text>
    )}
    <Row accessibilityRole="radiogroup" {...rowProps}>
      {options.map(option => {
        const isSelected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{selected: isSelected}}
            activeOpacity={0.7}
            hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}
            onPress={() => onChange(option.value)}
            style={[styles.chip, isSelected && styles.chipSelected]}>
            <Text
              size={14}
              color={isSelected ? colors[accent][0] : colors[gray][0]}
              style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Row>
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // En scroll el `gap` va en el contenido, no en el ScrollView: en el
  // contenedor no se aplicaria a los hijos que se desplazan.
  scrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: CHIP_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors[primary][0],
  },
  chipText: {
    fontWeight: '600',
  },
  chipTextSelected: {
    fontWeight: '700',
  },
});

export default ChipSelect;
