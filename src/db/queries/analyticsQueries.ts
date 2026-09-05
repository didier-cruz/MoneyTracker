import {SQLiteDatabase} from 'react-native-sqlite-storage';
import {getLocalTimeModifier, isValidPeriod, periodToRange} from './period';

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

  // El mes se calcula sobre la hora LOCAL, no sobre el prefijo de la
  // cadena. `substr(dateCreated, 1, 7)` leia el mes en UTC, asi que un
  // movimiento de las ultimas seis horas del dia (en UTC-6) se sumaba a
  // la barra del mes siguiente mientras la lista de movimientos lo
  // mostraba en el mes anterior. Ver `periodToRange` para la medicion
  // completa y `getLocalTimeModifier` para el limite con el horario de
  // verano.
  const localModifier = getLocalTimeModifier();

  const [resultSet] = await db.executeSql(
    `SELECT month, SUM(income) AS income, SUM(expense) AS expense, SUM(savings) AS savings
      FROM (
        SELECT
          strftime('%Y-%m', datetime(f.dateCreated, ?)) AS month,
          CASE WHEN f.amount > 0 THEN f.amount ELSE 0 END AS income,
          CASE WHEN f.amount < 0 THEN -f.amount ELSE 0 END AS expense,
          0 AS savings
        FROM finances f
        WHERE ${financesConditions.join(' AND ')}
        UNION ALL
        SELECT
          strftime('%Y-%m', datetime(m.dateCreated, ?)) AS month,
          0 AS income,
          0 AS expense,
          m.amount AS savings
        FROM envelope_movements m
        JOIN envelopes e ON e.id = m.idEnvelope
        WHERE ${movementsConditions.join(' AND ')}
      ) combined
      GROUP BY month
      ORDER BY month ASC;`,
    // El orden importa y ahora tiene cuatro tramos, no dos: `executeSql`
    // liga un unico array posicional a toda la sentencia, y el `?` del
    // modificador aparece en el SELECT de cada mitad, ANTES de los `?`
    // de su propio WHERE. Cualquier otro orden liga el desfase a una
    // fecha y la fecha al desfase, en silencio.
    [localModifier, ...financesParams, localModifier, ...movementsParams],
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
  /** ISO-8601, cota inferior INCLUSIVA. Omitirla significa "sin cota
   * inferior", no es un error — ver `resolveCategoryDateRange`. */
  startDate?: string;
  /** ISO-8601, cota superior EXCLUSIVA. Omitirla significa "hasta
   * ahora". */
  endDate?: string;
}

/**
 * Resuelve `{period}` o `{startDate, endDate}` en un tramo semiabierto
 * `[start, end)` — la validacion que `getSpendingByCategory` y
 * `getIncomeByCategory` necesitan por igual, extraida una sola vez para
 * que no se separen entre si.
 *
 * **Cada cota es independiente y opcional.** Antes esta funcion lanzaba
 * `'period, or both startDate and endDate, are required'` cuando no le
 * daban ninguna: la guarda existia para atrapar a un llamador que se
 * olvidara de pasar el tramo. Dejo de ser correcta cuando llego el
 * selector de periodo global: `resolvePeriod` devuelve `from`/`to`
 * indefinidos a proposito para "Todo el historico" (ver
 * `@utils/periodSelection`), que es una peticion legitima, no un
 * descuido. `getFinances` ya trataba sus cotas como opcionales por esta
 * misma razon; esto lo alinea en lugar de obligar a cada llamador a
 * inventarse un `'0000-01-01'`, que es la clase de centinela que luego
 * se cuela en una comparacion de fechas.
 *
 * Sigue lanzando `Error('Invalid period: ...')` con un `period` mal
 * formado — eso si es siempre un error del llamador.
 */
const resolveCategoryDateRange = (
  opts: IGetSpendingByCategoryOptions,
): {start?: string; end?: string} => {
  if (opts.period !== undefined) {
    if (!isValidPeriod(opts.period)) {
      throw new Error(`Invalid period: ${opts.period}`);
    }
    return periodToRange(opts.period);
  }
  return {start: opts.startDate, end: opts.endDate};
};

/**
 * Las clausulas de fecha y sus parametros, saltandose la cota que no
 * venga. Se construye aqui y no en linea porque las DOS consultas de
 * este archivo la necesitan identica: interpolar una condicion SQL es
 * la unica interpolacion permitida en este proyecto y conviene que
 * ocurra en un solo sitio.
 */
const buildDateRangeSql = (range: {start?: string; end?: string}) => {
  const clauses: string[] = [];
  const params: string[] = [];
  if (range.start !== undefined) {
    clauses.push('AND f.dateCreated >= ?');
    params.push(range.start);
  }
  if (range.end !== undefined) {
    clauses.push('AND f.dateCreated < ?');
    params.push(range.end);
  }
  return {sql: clauses.join('\n        '), params};
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
 * Omitir una cota (o las dos) NO es un error: significa "sin limite por
 * ese lado" — ver `resolveCategoryDateRange`. Solo lanza
 * `Error('Invalid period: ...')` con un `period` mal formado.
 */
export const getSpendingByCategory = async (
  db: SQLiteDatabase,
  opts: IGetSpendingByCategoryOptions,
): Promise<ISpendingByCategory[]> => {
  const {sql: dateSql, params: dateParams} = buildDateRangeSql(resolveCategoryDateRange(opts));

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
        ${dateSql}
      GROUP BY c.id
      ORDER BY spent DESC;`,
    dateParams,
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
 * Omitir una cota (o las dos) NO es un error: significa "sin limite por
 * ese lado" — ver `resolveCategoryDateRange`. Solo lanza
 * `Error('Invalid period: ...')` con un `period` mal formado.
 */
export const getIncomeByCategory = async (
  db: SQLiteDatabase,
  opts: IGetSpendingByCategoryOptions,
): Promise<IIncomeByCategory[]> => {
  const {sql: dateSql, params: dateParams} = buildDateRangeSql(resolveCategoryDateRange(opts));

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
        ${dateSql}
      GROUP BY c.id
      ORDER BY income DESC;`,
    dateParams,
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

export interface IMonthlyCategorySpending {
  /** `'YYYY-MM'` en huso LOCAL. */
  period: string;
  category: ICategory;
  /** Cents `> 0`. */
  spent: number;
}

/**
 * Gasto por categoria y por mes, TODO el historial, en una sola
 * consulta — la base del logro "gastaste menos que tu promedio", que a
 * diferencia de los limites no necesita que el usuario haya
 * configurado nada.
 *
 * Devuelve una fila por (mes, categoria) con gasto; los meses en que
 * una categoria no se uso simplemente no aparecen, y quien consume esto
 * debe tratar esa ausencia como "sin datos", NO como cero: una
 * categoria que no usaste no es una categoria en la que gastaste menos.
 *
 * Mismo `strftime` sobre la fecha desplazada al huso local que
 * `getCashFlowByMonth` — ver alli el motivo.
 *
 * Sin cota de fechas a proposito: la comparacion es contra el historial,
 * y recortarlo por el periodo global seleccionado daria un "promedio"
 * distinto en cada pantalla.
 */
export const getMonthlySpendingByCategory = async (
  db: SQLiteDatabase,
): Promise<IMonthlyCategorySpending[]> => {
  const [resultSet] = await db.executeSql(
    `SELECT
        strftime('%Y-%m', datetime(f.dateCreated, ?)) AS period,
        c.id AS categoryId,
        c.category AS categoryName,
        c.icon AS categoryIcon,
        c.type AS categoryType,
        -SUM(f.amount) AS spent
      FROM finances f
      JOIN categories c ON c.id = f.idCategory
      WHERE f.idCategory IS NOT NULL AND f.amount < 0
      GROUP BY period, c.id
      HAVING spent > 0
      ORDER BY period DESC, spent DESC;`,
    [getLocalTimeModifier()],
  );

  const rows: IMonthlyCategorySpending[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    const row = resultSet.rows.item(index);
    rows.push({
      period: row.period,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        icon: row.categoryIcon,
        type: row.categoryType,
      },
      spent: row.spent,
    });
  }
  return rows;
};
