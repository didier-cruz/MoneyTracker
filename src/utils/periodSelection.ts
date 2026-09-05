import {formatMonthYearLong} from '@utils/dateFormat';
import i18n from '@i18n';

/**
 * El tramo de tiempo que mira TODA la app.
 *
 * Se guarda la INTENCION, no un par de fechas ya resueltas: "este mes"
 * sigue significando este mes cuando cruza la medianoche del dia 1, y
 * "ultimos 3 meses" se recalcula solo. Guardar `{from, to}` congelaria
 * la eleccion en el instante en que se hizo — es la misma trampa que
 * `useBudgetsScreen` tenia con su `useRef(getCurrentPeriod())`.
 */
export type PeriodSelection =
  | {kind: 'month'; period: string}
  | {kind: 'lastMonths'; count: number}
  | {kind: 'year'; year: number}
  | {kind: 'all'}
  | {kind: 'custom'; from: string; to: string};

/** Lo que la app mira al arrancar. */
export const DEFAULT_PERIOD: PeriodSelection = {kind: 'month', period: currentMonth()};

/** `'YYYY-MM'` del mes en curso, en hora LOCAL. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Desplaza un `'YYYY-MM'` en meses. `-1` es el mes anterior. */
export const shiftMonth = (period: string, delta: number): string => {
  const [year, month] = period.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return currentMonth(d);
};

export interface IResolvedPeriod {
  /** ISO inclusive, o `undefined` para "sin cota inferior". */
  from?: string;
  /** ISO EXCLUSIVO, o `undefined` para "hasta ahora". */
  to?: string;
  /** El mes al que se ancla lo que solo sabe de meses — los limites de
   * categoria, que el esquema define por `'YYYY-MM'`. Es el mes MAS
   * RECIENTE del tramo. */
  anchorMonth: string;
  /** Texto para la cabecera. */
  label: string;
}

/**
 * Convierte la intencion en fechas concretas.
 *
 * Los limites son medianoche LOCAL —`new Date(y, m, d)`, no `Date.UTC`—
 * por lo mismo que `periodToRange`: partir el mes por la medianoche de
 * Greenwich mandaba las ultimas seis horas de cada dia al mes siguiente.
 */
export const resolvePeriod = (
  selection: PeriodSelection,
  now: Date = new Date(),
): IResolvedPeriod => {
  // `String(...)` porque el tipado de i18next devuelve un resultado
  // detallado, no una cadena, cuando se le pasan opciones.
  const t = (key: string, opts?: object): string =>
    String(i18n.t(`period.${key}`, opts as never));

  switch (selection.kind) {
    case 'month': {
      const [year, month] = selection.period.split('-').map(Number);
      return {
        from: new Date(year, month - 1, 1).toISOString(),
        to: new Date(year, month, 1).toISOString(),
        anchorMonth: selection.period,
        label: formatMonthYearLong(selection.period),
      };
    }
    case 'lastMonths': {
      const from = new Date(now.getFullYear(), now.getMonth() - (selection.count - 1), 1);
      return {
        from: from.toISOString(),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
        anchorMonth: currentMonth(now),
        label: t('lastMonths', {count: selection.count}),
      };
    }
    case 'year':
      return {
        from: new Date(selection.year, 0, 1).toISOString(),
        to: new Date(selection.year + 1, 0, 1).toISOString(),
        anchorMonth:
          selection.year === now.getFullYear() ? currentMonth(now) : `${selection.year}-12`,
        label: String(selection.year),
      };
    case 'custom':
      return {
        from: selection.from,
        to: selection.to,
        anchorMonth: currentMonth(new Date(selection.to)),
        label: t('customRange'),
      };
    case 'all':
    default:
      // Sin cotas: `getFinances` trata `from`/`to` como opcionales.
      return {anchorMonth: currentMonth(now), label: t('all')};
  }
};
