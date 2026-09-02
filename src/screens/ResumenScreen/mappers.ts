import {ICashFlowMonth, IFinanceRow} from '@db/queries';
import {colors} from '@constants/colors/colors';
import {formatDisplayDate, formatMonthAbbreviation} from '@utils/dateFormat';
import i18n from '@i18n';

/** How many trailing months the cash-flow chart asks `@db/queries` for
 * — matches the approved prototype's "Last 6 months" card label. This
 * is a REQUEST window, not a render guarantee: `getCashFlowByMonth`
 * only ever returns months with actual activity, so a fresh install (or
 * one only a month old) legitimately gets back 0..6 rows, never padded
 * with zero-filled gap months — see `CashFlowChart`, which renders
 * however many groups it's actually given. */
const CASH_FLOW_WINDOW_MONTHS = 6;

/** The current calendar month as `'YYYY-MM'` — same shape
 * `getCashFlowByMonth`/`ICashFlowMonth.month` use. */
export const getCurrentPeriod = (now: Date = new Date()): string => {
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * The lower bound to pass as `getCashFlowByMonth`'s `startMonth` —
 * `CASH_FLOW_WINDOW_MONTHS - 1` months before the current one, so the
 * inclusive `[start, now]` window covers exactly six calendar months
 * (this one plus the five before it) when that much history exists.
 */
export const getCashFlowWindowStartMonth = (now: Date = new Date()): string => {
  const past = new Date(now.getFullYear(), now.getMonth() - (CASH_FLOW_WINDOW_MONTHS - 1), 1);
  return getCurrentPeriod(past);
};

/** `'2026-08'` -> `'Aug'` (en) / `'ago'` (es) — the chart's per-group
 * x-axis label. Locale-aware, see `@utils/dateFormat`'s doc. */
export const getMonthAbbreviation = (period: string): string => formatMonthAbbreviation(period);

export interface ICurrentMonthCashFlow {
  /** Cents, `>= 0`. */
  income: number;
  /** Cents, `>= 0`. */
  expense: number;
  /** Cents, signed — see `ICashFlowMonth.savings`'s own doc. */
  savings: number;
}

/**
 * Picks THIS calendar month's row out of `getCashFlowByMonth`'s result
 * for the balance card's three mini-stats — a snapshot of "what's
 * happened so far this month" to sit next to "Available"'s all-time
 * snapshot. Defaults to all-zero (not missing/undefined) when the
 * current month has no qualifying activity yet — an accurate "$0.00 so
 * far this month" reading, not the chart's own "no data at all" empty
 * state (see `CashFlowChart`'s doc for that distinction).
 */
export const getCurrentMonthCashFlow = (
  months: ICashFlowMonth[],
  now: Date = new Date(),
): ICurrentMonthCashFlow => {
  const currentPeriod = getCurrentPeriod(now);
  const found = months.find(month => month.month === currentPeriod);
  return {
    income: found?.income ?? 0,
    expense: found?.expense ?? 0,
    savings: found?.savings ?? 0,
  };
};

/**
 * Labels a transfer leg for the dashboard's global "recent movements"
 * preview — a LOCAL, simplified copy of
 * `AccountsScreen/mappers.ts`'s own (unexported) `getTransferLabel`,
 * duplicated rather than imported: that file is out of this slice's
 * scope to touch/depend on (see this screen's HANDOFF), and this
 * preview only ever shows a handful of the most recent rows (never a
 * per-account history), so it doesn't need that function's `receivable`
 * counterpart-kind nuance — "Transfer to/from `<counterpart>`" covers
 * every case this list actually renders.
 */
const getTransferLabel = (row: IFinanceRow): string => {
  const name = row.transferCounterpartAccount?.name ?? i18n.t('common.transfer.unknownAccount');
  return row.amount < 0 ? i18n.t('common.transfer.to', {name}) : i18n.t('common.transfer.from', {name});
};

/**
 * Maps one `getFinances` row to `TransactItem`'s shape for this screen's
 * "Movements" preview card. Unlike `AccountsScreen`'s per-account list
 * (whose rows already imply the account, so `TransactItem.date` is just
 * a bare time), this preview spans every account, so the approved
 * prototype's "fecha y cuenta debajo" (date AND account under the name)
 * is rendered as one combined subtitle string — `TransactItem` only has
 * a single free-form `date` slot, so this is done by formatting, not by
 * changing that shared atom's shape for a need only this screen has.
 */
/**
 * Etiqueta de un movimiento SIN categoria. Hay dos motivos distintos
 * para que no la tenga y no se leen igual:
 *
 * - Es una transferencia (`transferGroupId`): su etiqueta describe la
 *   contraparte, ver `getTransferLabel`.
 * - Su categoria fue BORRADA (`deleteCategory` pone `idCategory` a NULL
 *   en vez de borrar el movimiento, para no destruir historial): el
 *   movimiento sigue siendo un gasto o un ingreso normal, solo que ya
 *   sin etiqueta. Antes caia en `getTransferLabel` y se anunciaba como
 *   "Transferencia a cuenta desconocida", que es simplemente falso.
 */
const describeUncategorized = (row: IFinanceRow): string =>
  row.transferGroupId ? getTransferLabel(row) : i18n.t('common.noCategory');

export const mapFinanceRowToTransactItem = (row: IFinanceRow): TransactItem => ({
  id: row.id,
  icon: row.category?.icon ?? 'exchange',
  category: row.category?.name ?? describeUncategorized(row),
  amount: row.amount,
  date: `${formatDisplayDate(row.dateCreated)} · ${row.account.name}`,
  color: row.amount > 0 ? colors.success[0] : colors.error[0],
});

export const mapFinancesToTransactItems = (rows: IFinanceRow[]): TransactItem[] =>
  rows.map(mapFinanceRowToTransactItem);

/**
 * Adapta los meses de flujo de caja a la forma que espera `PieChart`:
 * un selector de periodo (`items`) y, por cada uno, sus tres sectores.
 *
 * Los valores van en CENTAVOS, como en toda la app: las proporciones del
 * pastel son las mismas y el importe del centro se formatea al mostrarse.
 * El orden de los sectores importa — `PieChart.onPressChartItem` deduce
 * la etiqueta del centro por indice: 0 ahorros, 1 gastos, 2 ingresos.
 */
export const mapCashFlowToPieChart = (months: ICashFlowMonth[]) => {
  const ordered = [...months].reverse(); // el mes mas reciente primero
  return {
    items: ordered.map(month => ({
      value: month.month,
      label: getMonthAbbreviation(month.month),
    })),
    data: ordered.map(month => ({
      value: month.month,
      finances: [
        {value: month.savings, color: colors.warning[0]},
        {value: month.expense, color: colors.error[0]},
        {value: month.income, color: colors.accent[1]},
      ],
    })),
  };
};
