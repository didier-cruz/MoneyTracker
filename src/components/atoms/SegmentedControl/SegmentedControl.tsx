import {StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle} from 'react-native';
import {accent, colors, gray, white} from '@constants/colors/colors';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  /** Active-state text color for THIS option — lets a two-tone control
   * like `TypeSegment` (expense red / income green) override the
   * default per option. @default `colors[accent][1]` — this app's one
   * existing "selected radio" tint (`KindField`/`RadioField`'s old
   * `Radio.Group`'s `activeColor` prop, see this component's own doc
   * comment). */
  activeColor?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Como se reparten las pastillas.
   *
   * - `'auto'` (por defecto) aplica la regla historica descrita en el
   *   doc de abajo: una fila a partes iguales con 2 opciones o menos,
   *   rejilla que envuelve con mas.
   * - `'even'` fuerza la fila a partes iguales sin importar cuantas
   *   opciones haya.
   *
   * Existe porque la regla automatica mira el NUMERO de opciones y no
   * el largo de las etiquetas, que es lo que de verdad decide si caben.
   * Con tres etiquetas cortas (el filtro Todos/Fondos/Deudas de
   * `EnvelopesSection`) el `minWidth: '47%'` de la rejilla mete dos
   * pastillas por fila y deja la tercera sola debajo, ocupando el doble
   * de alto para nada. Cambiar el umbral de 2 a 3 no era opcion: los 4
   * tipos de cuenta de `KindField` SI necesitan envolver, y ese caso es
   * justo el que la regla vino a arreglar.
   */
  layout?: 'auto' | 'even';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Same one-off neutral `TypeSegment` already used for its track — no
// equivalent in `@constants/colors`, same precedent as
// `ArchivedAccounts.tsx`'s own ad hoc `#373737`.
const SEGMENT_TRACK_BG = '#EDEDF2';

/**
 * Two-(or more-)option segmented pill control — the visual language
 * `TypeSegment` (Gasto/Ingreso, `FormScreen`) already established,
 * extracted here so every other "pick one of two" control in this app
 * reuses it instead of inventing a third style. Replaces
 * `@redshank/native`'s `Radio.Group`/`Radio` at every remaining call
 * site (`KindField` ×2, `RadioField`) — that library's own `Radio` had
 * NO accessibility annotations at all (plain `TouchableOpacity`, no
 * `accessibilityRole`/`accessibilityState`); this one adds
 * `radiogroup`/`radio` + `accessibilityState.selected`, a real
 * improvement, not a like-for-like port. See the `@redshank/native`
 * removal slice's HANDOFF for the full call-site survey (and why
 * `SelectPro` — the OTHER `useTheme()` call site salvaged nothing —
 * was deleted instead of migrated).
 *
 * Con `layout="auto"` (por defecto): `options.length <= 2`
 * (`RadioField`, `KindField` for envelopes,
 * `TypeSegment`) keeps `TypeSegment`'s original even-split `flex: 1`
 * pills, one row, full width. `options.length > 2` — ONLY
 * `KindField` for accounts, 4 kinds — switches each pill to its own
 * content width and lets the track wrap onto more than one row instead
 * of dividing 4 ways into illegibly narrow slivers. This isn't a
 * cosmetic choice: `Radio.Group`'s OLD un-wrapped single-row layout
 * (`@redshank/native`'s `Group`, `align="horizontal"`'s default, no
 * `flexWrap`) silently ran the 4th kind ("Por cobrar") off the right
 * edge of the screen with no way to reach it — reproduced in the
 * emulator on `CreateAccount` before this migration. Wrapping fixes
 * that as a natural consequence of not hardcoding a single-row
 * assumption, not a deliberate redesign.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layout = 'auto',
  style,
  testID,
}: SegmentedControlProps<T>) {
  const wraps = layout === 'auto' && options.length > 2;
  return (
    <View
      style={[styles.track, wraps && styles.trackWraps, style]}
      accessibilityRole="radiogroup"
      testID={testID}>
      {options.map(option => {
        const isActive = value === option.value;
        const activeColor = option.activeColor ?? colors[accent][1];
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{selected: isActive}}
            hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}
            style={[
              styles.pill,
              wraps ? styles.pillAuto : styles.pillFlex,
              isActive && styles.pillActive,
            ]}
            onPress={() => onChange(option.value)}>
            <Text
              style={[
                styles.pillText,
                {color: isActive ? activeColor : colors[gray][0]},
                isActive && styles.pillTextActive,
              ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: SEGMENT_TRACK_BG,
    borderRadius: 14,
    padding: 4,
  },
  trackWraps: {
    flexWrap: 'wrap',
  },
  pill: {
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillFlex: {
    flex: 1,
  },
  pillAuto: {
    minWidth: '47%',
    flexGrow: 1,
    paddingHorizontal: 12,
  },
  pillActive: {
    backgroundColor: colors[white][0],
    // Idem: una sola sombra para las dos plataformas, y que respete
    // el radio de la pastilla.
    boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.07)',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextActive: {
    fontWeight: '700',
  },
});

export default SegmentedControl;
