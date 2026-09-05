import {FC} from 'react';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';

import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {BottomSheet} from '@components/organisms/feedback';
import {colors, gray, primary} from '@constants/colors/colors';
import {formatMonthYearLong} from '@utils/dateFormat';
import {
  currentMonth,
  PeriodSelection,
  shiftMonth,
} from '@utils/periodSelection';

export interface PeriodPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  selection: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
  /**
   * Oculta los atajos de RANGO y deja solo el paginador de mes.
   *
   * Lo usa Presupuestos: un limite mensual vive en `category_budgets`
   * con `UNIQUE (idCategory, period)`, asi que "ultimos 3 meses" no
   * tiene un limite unico contra el que comparar. Antes que enseñar un
   * atajo que esa pantalla no puede honrar, no se enseña.
   */
  monthsOnly?: boolean;
}

/**
 * Elige el periodo que mira toda la app.
 *
 * Dos formas de moverse, a proposito: el PAGINADOR para ir mes a mes —el
 * gesto habitual en una app de finanzas— y los ATAJOS para saltar a un
 * tramo. Con solo atajos no hay forma de llegar a "marzo"; con solo
 * paginador no hay forma de ver un año entero.
 */
export const PeriodPickerSheet: FC<PeriodPickerSheetProps> = ({
  visible,
  onClose,
  selection,
  onChange,
  monthsOnly = false,
}) => {
  const {t} = useTranslation();
  const now = new Date();
  const thisMonth = currentMonth(now);

  // El mes que muestra el paginador. Si el periodo elegido es un tramo
  // (año, ultimos 3 meses, todo), el paginador parte del mes en curso:
  // es el punto de referencia que el usuario tiene en la cabeza.
  const pagerMonth = selection.kind === 'month' ? selection.period : thisMonth;

  /**
   * No se puede avanzar mas alla del mes en curso.
   *
   * Antes el paginador no tenia tope, con el argumento de que un
   * movimiento podria tener fecha futura. No puede: `insertFinance` se
   * llama SIN `dateCreated` desde el unico formulario que crea
   * movimientos (`useFormScreen.ts:274`), asi que la fecha es siempre el
   * instante de guardar. Un mes futuro solo puede estar vacio, y un
   * control que solo lleva a pantallas vacias no deberia estar activo.
   *
   * Comparacion de cadenas y no de fechas: `'YYYY-MM'` ordena
   * lexicograficamente igual que cronologicamente, que es justo para lo
   * que se eligio ese formato.
   */
  const canGoForward = pagerMonth < thisMonth;

  const pick = (next: PeriodSelection) => {
    onChange(next);
    onClose();
  };

  const shortcuts: {key: string; label: string; value: PeriodSelection}[] = [
    {key: 'thisMonth', label: t('period.thisMonth'), value: {kind: 'month', period: thisMonth}},
    {
      key: 'lastMonth',
      label: t('period.lastMonth'),
      value: {kind: 'month', period: shiftMonth(thisMonth, -1)},
    },
    ...(monthsOnly
      ? []
      : [
          {
            key: 'last3',
            label: t('period.lastMonths', {count: 3}),
            value: {kind: 'lastMonths', count: 3} as PeriodSelection,
          },
          {
            key: 'thisYear',
            label: t('period.thisYear'),
            value: {kind: 'year', year: now.getFullYear()} as PeriodSelection,
          },
          {key: 'all', label: t('period.all'), value: {kind: 'all'} as PeriodSelection},
        ]),
  ];

  const isActive = (value: PeriodSelection): boolean =>
    JSON.stringify(value) === JSON.stringify(selection);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="70%" contentStyle={styles.sheet}>
      <Title level={4} style={styles.title}>
        {t('period.title')}
      </Title>

      {/* Paginador. Aplica el mes al instante (`onChange`) sin cerrar la
          hoja, para poder recorrer meses seguidos; los atajos de abajo
          si cierran (`pick`). El tope superior esta en `canGoForward`,
          ver su doc. */}
      <View style={styles.pager}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('period.previousMonth')}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          onPress={() => onChange({kind: 'month', period: shiftMonth(pagerMonth, -1)})}
          style={styles.pagerArrow}>
          <VectorIcon name="chevron-left" size={16} color={colors[primary][0]} />
        </TouchableOpacity>

        <Text size={16} fontWeight="600" align="center" style={styles.pagerLabel}>
          {formatMonthYearLong(pagerMonth)}
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('period.nextMonth')}
          // `disabled` de verdad, no solo un color apagado: un control
          // que se ve inerte pero responde al toque es peor que uno que
          // no responde a ninguno de los dos.
          disabled={!canGoForward}
          accessibilityState={{disabled: !canGoForward}}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          onPress={() => onChange({kind: 'month', period: shiftMonth(pagerMonth, 1)})}
          style={styles.pagerArrow}>
          <VectorIcon
            name="chevron-right"
            size={16}
            color={canGoForward ? colors[primary][0] : colors.inactive[0]}
          />
        </TouchableOpacity>
      </View>

      {monthsOnly && (
        <Text size={12} color={colors[gray][0]} style={styles.note}>
          {t('period.monthsOnlyHere')}
        </Text>
      )}

      <ScrollView style={styles.list}>
        {shortcuts.map(item => {
          const active = isActive(item.value);
          return (
            <TouchableOpacity
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              accessibilityLabel={item.label}
              onPress={() => pick(item.value)}
              style={[styles.row, active && styles.rowActive]}>
              <Text size={14} lines={1} style={styles.rowLabel}>
                {item.label}
              </Text>
              {active && (
                <VectorIcon name="check" size={14} color={colors[primary][0]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
  },
  title: {
    marginBottom: 14,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.surface[0],
    borderWidth: 1,
    borderColor: colors.inactive[0],
  },
  pagerArrow: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagerLabel: {
    flex: 1,
  },
  note: {
    marginTop: 10,
  },
  list: {
    flexShrink: 1,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rowActive: {
    backgroundColor: `${colors[primary][0]}14`,
  },
  rowLabel: {
    flex: 1,
  },
});

export default PeriodPickerSheet;
