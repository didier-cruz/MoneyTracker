import {SQLiteDatabase} from 'react-native-sqlite-storage';
import {isValidPeriod, periodToRange} from './period';

/**
 * Dashboard / Analítica aggregations. Every function here does its
 * summing INSIDE SQLite (one `GROUP BY`/`SUM` round trip) — never
 * `getFinances(...).reduce(...)` in JS — per the task's explicit
 * efficiency requirement. Envelope/category-budget specific totals
 * (Fondos/Deudas pie-chart totals, per-category budget-vs-spent) live in
 * `envelopesQueries.ts`/`budgetsQueries.ts` instead of here — see this
 * file's exports for exactly the four aggregates it DOES own: the
 * cash-flow-by-month chart, the spend-by-category breakdown, and its
 * income-by-category sibling (`getIncomeByCategory` — same shape,
 * opposite amount-sign filter; see that function's doc comment for why
 * this is a SIBLING function rather than a `type` parameter bolted onto
 * `getSpendingByCategory`).
 */

export interface ICashFlowMonth {
  /** `'YYYY-MM'`. */
  month: string;
  /** Cents, `>= 0`. Sum of every categorized (`idCategory IS NOT NULL`)
   * positive `finances.amount` in this month. */
  income: number;
  /** Cents, `>= 0` (a magnitude, not signed — easier for a chart to plot
   * as a positive bar next to `income`). Sum of every categorized
   * negative `finances.amount` in this month, negated. */
  expense: number;
  /**
   * Cents. NET `SUM(envelope_movements.amount)` for `fund`-kind envelopes
   * in this month — i.e. "lo asignado a sobres de tipo fondo", NETTED
   * against any withdrawal from a fund envelope in the SAME month.
   *
   * This is this agent's interpretation of an intentionally short product
   * instruction ("los ahorros son lo asignado a sobres de tipo fondo"),
   * flagged for review: a strictly GROSS reading (assignments only,
   * ignoring same-month withdrawals) would let a user assign $200 to an
   * emergency fund and withdraw it again in the same month and still see
   * "+$200 ahorrado" for a month where, by the time it ends, $0 is
   * actually sitting apartado in that fund. NET makes the chart answer
   * "how much did the user's fund envelopes actually grow this month",
   * which is the number a cash-flow chart is for. If product wants GROSS
   * instead, the fix is confined to the `savings` computation below.
   * Can be negative (net fund withdrawal for the month).
   */
  savings: number;
}

export interface IGetCashFlowByMonthOptions {
  /** `'YYYY-MM'`, inclusive lower bound. Omit for no lower bound (every
   * month with any activity). */
  startMonth?: string;
  /** `'YYYY-MM'`, inclusive upper bound. Omit for no upper bound. */
  endMonth?: string;
}

/**
 * Monthly income/expense/savings totals for the cash-flow chart — one
 * row per month that has ANY qualifying activity (a month with zero
 * `finances`/`envelope_movements` rows simply does not appear; this
 * function does not manufacture zero-filled gap rows for months with no
 * data — the FE is expected to do that if the chart needs a continuous
 * axis).
 *
 * Single `UNION ALL` query: `finances` rows contribute to
 * `income`/`expense` (`envelope_movements`' contribution forced to 0 in
 * that half), fund-envelope `envelope_movements` rows contribute to
 * `savings` (`finances`' contribution forced to 0 in that half), both
 * halves bucketed by `substr(dateCreated, 1, 7)` (`'YYYY-MM'`) and
 * `SUM`med together per month by the outer `GROUP BY` — everything
 * computed in ONE round trip, no JS-side summation or per-table
 * round-trip merging.
 *
 * - The `finances` half filters `idCategory IS NOT NULL` — excludes
 *   every transfer leg, same rule documented at length on
 *   `IFinanceRow.category` in `financesQueries.ts`: a transfer's two legs
 *   are neither income nor expense, and must never be counted as a fake
 *   one of each.
 * - The `envelope_movements` half joins to `envelopes` and filters
 *   `kind = 'fund'` — a `debt` envelope's assignments/withdrawals are
 *   NOT savings (they are money being set aside for a debt, not grown
 *   wealth); see `savings`'s doc above for the NET-vs-GROSS choice within
 *   the fund half itself.
 * - Backed by `idx_finances_date_id` (existing, migration 4) for the
 *   `finances` half's date-range scan, and `idx_envelope_movements_date`
 *   (migration 5) for the `envelope_movements` half's.
 */
export const getCashFlowByMonth = async (
  db: SQLiteDatabase,
  opts: IGetCashFlowByMonthOptions = {},
): Promise<ICashFlowMonth[]> => {
  if (opts.startMonth !== undefined && !isValidPeriod(opts.startMonth)) {
    throw new Error(`Invalid period: ${opts.startMonth}`);
  }
  if (opts.endMonth !== undefined && !isValidPeriod(opts.endMonth)) {
    throw new Error(`Invalid period: ${opts.endMonth}`);
  }

  const financesConditions: string[] = ['f.idCategory IS NOT NULL'];
  const movementsConditions: string[] = ["e.kind = 'fund'"];

  // Each half of the `UNION ALL` below gets its OWN copy of the same
  // start/end bound params, in the same relative order its own `?`
  // placeholders appear in the query text (`finances` half first, then
  // `envelope_movements` half) — `executeSql` binds one flat positional
  // array across the whole statement regardless of the `UNION ALL`
  // structure, so the params array must be laid out exactly
  // [financesStart?, financesEnd?, movementsStart?, movementsEnd?].
  const financesParams: string[] = [];
  const movementsParams: string[] = [];
  if (opts.startMonth !== undefined) {
    const {start} = periodToRange(opts.startMonth);
    financesConditions.push('f.dateCreated >= ?');
    movementsConditions.push('m.dateCreated >= ?');
    financesParams.push(start);
    movementsParams.push(start);
  }
  if (opts.endMonth !== undefined) {
    const {end} = periodToRange(opts.endMonth);
    financesConditions.push('f.dateCreated < ?');
    movementsConditions.push('m.dateCreated < ?');
    financesParams.push(end);
    movementsParams.push(end);
  }

  const [resultSet] = await db.executeSql(
    `SELECT month, SUM(income) AS income, SUM(expense) AS expense, SUM(savings) AS savings
      FROM (
        SELECT
          substr(f.dateCreated, 1, 7) AS month,
          CASE WHEN f.amount > 0 THEN f.amount ELSE 0 END AS income,
          CASE WHEN f.amount < 0 THEN -f.amount ELSE 0 END AS expense,
          0 AS savings
        FROM finances f
        WHERE ${financesConditions.join(' AND ')}
        UNION ALL
        SELECT
          substr(m.dateCreated, 1, 7) AS month,
          0 AS income,
          0 AS expense,
          m.amount AS savings
        FROM envelope_movements m
        JOIN envelopes e ON e.id = m.idEnvelope
        WHERE ${movementsConditions.join(' AND ')}
      ) combined
      GROUP BY month
      ORDER BY month ASC;`,
    [...financesParams, ...movementsParams],
  );

  const months: ICashFlowMonth[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    const row = resultSet.rows.item(index);
    months.push({month: row.month, income: row.income, expense: row.expense, savings: row.savings});
  }
  return months;
};

export interface ISpendingByCategory {
  category: ICategory;
  /** Cents, `>= 0`. `-SUM(finances.amount)` for this category in the
   * requested range. */
  spent: number;
}

/**
 * Shared by `getSpendingByCategory` AND `getIncomeByCategory` — both
 * take the exact same "which date range" question (a `'YYYY-MM'`
 * shorthand, or an explicit `[startDate, endDate)`), so one options
 * shape (and one validation routine, `resolveCategoryDateRange` below)
 * serves both instead of two copies of the same period-vs-explicit-
 * range branching drifting apart. Kept under its original expense-side
 * name for backward compatibility — nothing outside this file imports
 * this type by name (call sites pass a `{period}` object literal
 * structurally), so renaming it carried no benefit, only churn.
 */
export interface IGetSpendingByCategoryOptions {
  /** `'YYYY-MM'` — convenience for "this calendar month". If provided,
   * `startDate`/`endDate` are ignored. */
  period?: string;
  /** ISO-8601, inclusive lower bound. Required (with `endDate`) if
   * `period` is omitted. */
  startDate?: string;
  /** ISO-8601, exclusive upper bound. Required (with `startDate`) if
   * `period` is omitted. */
  endDate?: string;
}

/**
 * Resolves `{period}` or `{startDate, endDate}` into a concrete
 * half-open `[start, end)` ISO-8601 range — the validation/branching
 * `getSpendingByCategory` and `getIncomeByCategory` both need,
 * extracted once so it can't drift between the two.
 *
 * Throws `Error('period, or both startDate and endDate, are required')`
 * if neither `period` nor both `startDate`/`endDate` are given, and
 * `Error('Invalid period: ...')` if `period` is malformed.
 */
const resolveCategoryDateRange = (
  opts: IGetSpendingByCategoryOptions,
): {start: string; end: string} => {
  if (opts.period !== undefined) {
    if (!isValidPeriod(opts.period)) {
      throw new Error(`Invalid period: ${opts.period}`);
    }
    return periodToRange(opts.period);
  }
  if (opts.startDate !== undefined && opts.endDate !== undefined) {
    return {start: opts.startDate, end: opts.endDate};
  }
  throw new Error('period, or both startDate and endDate, are required');
};

/**
 * Total spend per EXPENSE category in a date range, ordered highest-
 * spend first — the Analítica "gasto por categoría" breakdown (a pie/
 * bar chart's data, one row per slice, already summed in SQL).
 *
 * Filters `f.idCategory IS NOT NULL AND f.amount < 0` — excludes both
 * transfer legs (`idCategory IS NULL`) and any income row, so this can
 * never miscount a transfer or a paycheck as "spend". A category with
 * zero expense rows in the range does not appear (there is nothing to
 * `LEFT JOIN` zero-fill against here — unlike `getCategoryBudgets`, this
 * function is not anchored to a fixed list of categories to always
 * include).
 *
 * Backed by `idx_finances_date_id` (existing) for the range scan;
 * `idx_finances_idCategory_date_amount` (migration 5) is NOT the primary
 * index for this one — that index leads with `idCategory` for a
 * single-category lookup (`getCategoryBudgets`'s use case), whereas this
 * query has no `idCategory` equality predicate at all (it groups across
 * every category in the range), so the date-range index is what actually
 * drives it.
 *
 * Throws `Error('period, or both startDate and endDate, are required')`
 * if neither `period` nor both `startDate`/`endDate` are given, and
 * `Error('Invalid period: ...')` if `period` is malformed.
 */
export const getSpendingByCategory = async (
  db: SQLiteDatabase,
  opts: IGetSpendingByCategoryOptions,
): Promise<ISpendingByCategory[]> => {
  const {start, end} = resolveCategoryDateRange(opts);

  const [resultSet] = await db.executeSql(
    `SELECT
        c.id AS categoryId,
        c.category AS categoryName,
        c.icon AS categoryIcon,
        c.type AS categoryType,
        -SUM(f.amount) AS spent
      FROM finances f
      JOIN categories c ON c.id = f.idCategory
      WHERE f.idCategory IS NOT NULL AND f.amount < 0
        AND f.dateCreated >= ? AND f.dateCreated < ?
      GROUP BY c.id
      ORDER BY spent DESC;`,
    [start, end],
  );

  const items: ISpendingByCategory[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    const row = resultSet.rows.item(index);
    items.push({
      category: {id: row.categoryId, name: row.categoryName, icon: row.categoryIcon, type: row.categoryType},
      spent: row.spent,
    });
  }
  return items;
};

export interface IIncomeByCategory {
  category: ICategory;
  /** Cents, `>= 0`. `SUM(finances.amount)` for this category in the
   * requested range. */
  income: number;
}

/**
 * Total income per INCOME category in a date range, ordered highest-
 * income first — the income-side sibling of `getSpendingByCategory`,
 * same shape, `f.amount > 0` instead of `f.amount < 0` and no sign flip
 * on the `SUM` (income is already stored positive, see
 * `IFinanceRow.amount`'s sign convention in `financesQueries.ts`).
 *
 * ## Why a SIBLING function instead of generalizing
 * `getSpendingByCategory` with a `type: 'income' | 'expense'` param
 *
 * Both were considered. A `type` param would save a few lines of SQL
 * duplication, but at a real cost this table already has two live
 * consumers of the CURRENT contract (`useCategoriesScreen`'s Expenses
 * tab calls `getSpendingByCategory(db, {period})` today and destructures
 * `.spent`; `AnalysisScreen`'s "gasto por categoría" chart is the same
 * shape). The field name `spent` is only meaningful for the expense
 * case — a generalized function would have to either (a) keep returning
 * `spent` for an `income`-typed call, which is actively misleading
 * ("received: 50000" mislabeled as "spent"), or (b) rename the field to
 * something type-agnostic like `total`, which changes the return shape
 * for the ALREADY-WORKING expense call sites for zero functional gain.
 * Per this task's own instruction — breaking an existing, working
 * consumer is worse than adding a new export — a same-shaped sibling
 * function with its own honestly-named field (`income`, not `spent`)
 * costs a few duplicated lines of SQL and pays for a return type that is
 * never ambiguous about which direction of money it describes, and
 * leaves `getSpendingByCategory`'s call sites completely untouched. The
 * date-range validation/branching (the only non-trivial logic shared
 * between them) is NOT duplicated — both call the same
 * `resolveCategoryDateRange` helper above.
 *
 * Filters `f.idCategory IS NOT NULL AND f.amount > 0` — excludes both
 * transfer legs (`idCategory IS NULL` — see `IFinanceRow.category`'s doc
 * in `financesQueries.ts`: a transfer leg is neither income nor expense,
 * counting it here would inflate this side exactly the way counting it
 * in `getSpendingByCategory` would inflate that one) and any expense
 * row. A category with zero income rows in the range does not appear,
 * same no-zero-fill reasoning as `getSpendingByCategory`.
 *
 * Backed by `idx_finances_date_id` (existing, migration 4) for the
 * range scan — same index, same reasoning as `getSpendingByCategory`:
 * this query has no `idCategory` equality predicate (it groups across
 * every category in the range), so migration 5's `idx_finances_
 * idCategory_date_amount` (partial, leads with `idCategory`, built for
 * `getCategoryBudgets`'s single-category point lookup) does not apply
 * here either. No new index was added for this function.
 *
 * Throws `Error('period, or both startDate and endDate, are required')`
 * if neither `period` nor both `startDate`/`endDate` are given, and
 * `Error('Invalid period: ...')` if `period` is malformed.
 */
export const getIncomeByCategory = async (
  db: SQLiteDatabase,
  opts: IGetSpendingByCategoryOptions,
): Promise<IIncomeByCategory[]> => {
  const {start, end} = resolveCategoryDateRange(opts);

  const [resultSet] = await db.executeSql(
    `SELECT
        c.id AS categoryId,
        c.category AS categoryName,
        c.icon AS categoryIcon,
        c.type AS categoryType,
        SUM(f.amount) AS income
      FROM finances f
      JOIN categories c ON c.id = f.idCategory
      WHERE f.idCategory IS NOT NULL AND f.amount > 0
        AND f.dateCreated >= ? AND f.dateCreated < ?
      GROUP BY c.id
      ORDER BY income DESC;`,
    [start, end],
  );

  const items: IIncomeByCategory[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    const row = resultSet.rows.item(index);
    items.push({
      category: {id: row.categoryId, name: row.categoryName, icon: row.categoryIcon, type: row.categoryType},
      income: row.income,
    });
  }
  return items;
};
