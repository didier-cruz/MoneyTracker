import {IFinanceRow} from '@db/queries';
import {mapFinanceRowToTransactItem} from '@screens/ResumenScreen/mappers';
import i18n from '@i18n';

export type MonthSection = {
  /** `YYYY-MM` — clave estable para `keyExtractor` y para agrupar. */
  key: string;
  title: string;
  data: TransactItem[];
};

/**
 * Etiqueta de mes en el idioma activo, con el ano solo cuando NO es el
 * ano en curso: "Septiembre" para los meses de este ano y "Agosto 2025"
 * para los de otro. En una lista que puede abarcar anos, repetir el ano
 * en todas las cabeceras es ruido; omitirlo siempre seria ambiguo.
 */
const formatMonthTitle = (year: number, monthIndex: number): string => {
  const label = new Date(year, monthIndex, 1).toLocaleDateString(
    i18n.language,
    {month: 'long'},
  );
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return year === new Date().getFullYear() ? capitalized : `${capitalized} ${year}`;
};

/**
 * Agrupa los movimientos por MES, en el orden en que llegan (mas
 * recientes primero, como los devuelve `getFinances`).
 *
 * Se agrupa por la fecha LOCAL y no por la porcion `YYYY-MM` de la
 * cadena ISO: esta se guarda en UTC, asi que un movimiento del 31 a las
 * 22:00 en un huso negativo caeria en el mes siguiente. Es la misma
 * distincion que ya documenta `groupCategoryFinancesByDate` para los
 * dias.
 */
export const groupFinancesByMonth = (rows: IFinanceRow[]): MonthSection[] => {
  const sections: MonthSection[] = [];
  const byKey = new Map<string, MonthSection>();

  rows.forEach(row => {
    const date = new Date(row.dateCreated);
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

    let section = byKey.get(key);
    if (!section) {
      section = {key, title: formatMonthTitle(year, monthIndex), data: []};
      byKey.set(key, section);
      sections.push(section);
    }
    section.data.push(mapFinanceRowToTransactItem(row));
  });

  return sections;
};

export type TimeRange = 'all' | 'month' | 'quarter' | 'year';

/**
 * Convierte un rango en su ventana `[from, to)` en ISO, o `{}` para
 * "todo".
 *
 * Los limites se calculan con fechas LOCALES y se serializan a ISO, que
 * es como se guardan: asi "este mes" significa el mes del calendario
 * del usuario y no el de UTC.
 */
export const timeRangeToWindow = (
  range: TimeRange,
): {from?: string; to?: string} => {
  if (range === 'all') {
    return {};
  }
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (range === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to: to.toISOString(),
    };
  }
  if (range === 'quarter') {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      to: to.toISOString(),
    };
  }
  return {
    from: new Date(now.getFullYear(), 0, 1).toISOString(),
    to: to.toISOString(),
  };
};
