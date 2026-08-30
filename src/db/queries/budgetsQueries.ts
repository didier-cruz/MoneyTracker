import {SQLiteDatabase} from 'react-native-sqlite-storage';
import {isFiniteInteger} from './numberGuards';
import {isValidPeriod, periodToRange} from './period';

/**
 * Límites mensuales de gasto por categoría — `category_budgets`. Schema/
 * rationale in `src/db/migrations/005_envelopesAndCategoryBudgets.ts`.
 *
 * Distinct from `envelopesQueries.ts`: a budget never has its own
 * balance to consume — it is read back TOGETHER WITH how much was
 * actually spent in `finances` for that category/month. Answers "cuánto
 * llevo gastado", not "cuánto tengo apartado".
 */

export interface ICategoryBudget {
  id: number;
  idCategory: number;
  /** `'YYYY-MM'`. */
  period: string;
  /** Cents, always `> 0`. */
  limitAmount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `ICategoryBudget` plus the category it belongs to and how much was
 * ACTUALLY spent against it in `period`'s calendar month.
 *
 * - `spent`: `-SUM(finances.amount)` filtered to `finances.idCategory =
 *   this budget's idCategory` AND `finances.dateCreated` within
 *   `period`'s `[start, end)` range (see `periodToRange`). Negated
 *   because an expense category's `finances.amount` rows are always
 *   negative (enforced by `insertFinance` deriving the sign from the
 *   category's `type` — a budget can only be set on an `expense`
 *   category, see `setCategoryBudget`), so `spent` comes back as a
 *   positive "how much was spent" number. Filtering by a SPECIFIC
 *   `idCategory` value (never `NULL`) already excludes every transfer
 *   leg on its own (`finances.idCategory IS NULL` for those, and no
 *   `idCategory` column value can ever equal `NULL` via `=`) — see
 *   `IFinanceRow.category`'s doc in `financesQueries.ts` for why that
 *   exclusion matters for ANY spend aggregate.
 * - `remaining`: `limitAmount - spent`. Can be negative (over budget) —
 *   returned as-is, not clamped, so the FE decides how to present it
 *   (e.g. a red "te pasaste por $X" state).
 */
export interface ICategoryBudgetWithSpent extends ICategoryBudget {
  category: ICategory;
  spent: number;
  remaining: number;
}

export interface ISetCategoryBudgetInput {
  idCategory: number;
  /** `'YYYY-MM'`. */
  period: string;
  /** Cents, must be a positive integer. */
  limitAmount: number;
}

const mapRowToBudgetWithSpent = (row: any): ICategoryBudgetWithSpent => ({
  id: row.id,
  idCategory: row.idCategory,
  period: row.period,
  limitAmount: row.limitAmount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  category: {
    id: row.categoryId,
    name: row.categoryName,
    icon: row.categoryIcon,
    type: row.categoryType,
  },
  spent: row.spent,
  remaining: row.limitAmount - row.spent,
});

/**
 * Defines or updates the spending limit for one (category, month) pair —
 * "máximo $300 en Food este mes". Idempotent by `(idCategory, period)`:
 * an existing budget for that exact pair is UPDATED (`limitAmount`
 * replaced, `updatedAt` bumped); if none exists, one is INSERTED.
 *
 * Deliberately an explicit `UPDATE` then, only if it matched zero rows,
 * an `INSERT` — NOT `INSERT ... ON CONFLICT DO UPDATE` (needs SQLite
 * ≥ 3.24.0, a version this project has never pinned/verified — see the
 * migration file). The `UNIQUE (idCategory, period)` constraint is the
 * safety net if this ever raced with another writer (this app has none —
 * local-first, single-user, one connection — see
 * `transfersQueries.ts`'s `generateTransferGroupId` doc for the same
 * "no concurrent-writer story" reasoning applied elsewhere in this
 * schema).
 *
 * Throws:
 * - `Error('Invalid period: ...')` if `period` is not `'YYYY-MM'`.
 * - `Error('limitAmount must be a positive integer number of cents')` if
 *   `limitAmount` is not a safe, positive integer.
 * - `Error('Category <id> does not exist')` if `idCategory` does not
 *   resolve to a row in `categories`.
 * - `Error('Cannot set a budget on an income category (id <id>)')` if
 *   the category's `type` is `'income'` — a spending LIMIT on money
 *   coming IN is not a concept this product has. Not a DB `CHECK`
 *   (SQLite `CHECK` cannot see another table's column without a
 *   subquery, which is not supported) — checked here instead, same
 *   category-type lookup pattern `insertFinance` already uses.
 *
 * Returns the affected row's `id` (existing or newly created), not the
 * full row — call `getCategoryBudgets(db, period)` to read it back with
 * `spent`/`remaining` resolved.
 */
export const setCategoryBudget = async (
  db: SQLiteDatabase,
  {idCategory, period, limitAmount}: ISetCategoryBudgetInput,
): Promise<{id: number}> => {
  if (!isValidPeriod(period)) {
    throw new Error(`Invalid period: ${period}`);
  }
  if (!isFiniteInteger(limitAmount) || limitAmount <= 0) {
    throw new Error('limitAmount must be a positive integer number of cents');
  }

  const [categoryResult] = await db.executeSql('SELECT type FROM categories WHERE id = ?', [idCategory]);
  if (categoryResult.rows.length === 0) {
    throw new Error(`Category ${idCategory} does not exist`);
  }
  const categoryType = categoryResult.rows.item(0).type as ICategory['type'];
  if (categoryType === 'income') {
    throw new Error(`Cannot set a budget on an income category (id ${idCategory})`);
  }

  const now = new Date().toISOString();
  const [updateResult] = await db.executeSql(
    'UPDATE category_budgets SET limitAmount = ?, updatedAt = ? WHERE idCategory = ? AND period = ?',
    [limitAmount, now, idCategory, period],
  );
  if (updateResult.rowsAffected > 0) {
    const [existing] = await db.executeSql(
      'SELECT id FROM category_budgets WHERE idCategory = ? AND period = ?',
      [idCategory, period],
    );
    return {id: existing.rows.item(0).id};
  }

  const [insertResult] = await db.executeSql(
    `INSERT INTO category_budgets (idCategory, period, limitAmount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)`,
    [idCategory, period, limitAmount, now, now],
  );
  return {id: insertResult.insertId};
};

/**
 * Lists every budget defined for one calendar month, each joined to its
 * category and to how much was ACTUALLY spent against it in that same
 * month (`spent`, `remaining` — see `ICategoryBudgetWithSpent`).
 *
 * A single query, not one round trip per budget: the `spent` aggregate
 * is computed by a `LEFT JOIN` subquery over `finances` grouped by
 * `idCategory` and filtered to `period`'s `[start, end)` range, backed by
 * the covering index `idx_finances_idCategory_date_amount(idCategory,
 * dateCreated, amount) WHERE idCategory IS NOT NULL` (see the
 * migration) — SQLite can answer the per-category sum from that index
 * alone. A budget with zero matching `finances` rows in the month still
 * returns `spent = 0` (`COALESCE`), not `NULL`.
 *
 * Only returns categories that HAVE a budget set for `period` — a
 * category with no limit defined simply does not appear here (use
 * `analyticsQueries.ts`'s `getSpendingByCategory` for "how much was spent
 * per category" regardless of whether a limit exists).
 *
 * Throws `Error('Invalid period: ...')` if `period` is not `'YYYY-MM'`.
 */
export const getCategoryBudgets = async (
  db: SQLiteDatabase,
  period: string,
): Promise<ICategoryBudgetWithSpent[]> => {
  if (!isValidPeriod(period)) {
    throw new Error(`Invalid period: ${period}`);
  }
  const {start, end} = periodToRange(period);

  const [resultSet] = await db.executeSql(
    `SELECT
        cb.id AS id,
        cb.idCategory AS idCategory,
        cb.period AS period,
        cb.limitAmount AS limitAmount,
        cb.createdAt AS createdAt,
        cb.updatedAt AS updatedAt,
        c.id AS categoryId,
        c.category AS categoryName,
        c.icon AS categoryIcon,
        c.type AS categoryType,
        -COALESCE(f.total, 0) AS spent
      FROM category_budgets cb
      JOIN categories c ON c.id = cb.idCategory
      LEFT JOIN (
        SELECT idCategory, SUM(amount) AS total
        FROM finances
        WHERE idCategory IS NOT NULL AND dateCreated >= ? AND dateCreated < ?
        GROUP BY idCategory
      ) f ON f.idCategory = cb.idCategory
      WHERE cb.period = ?
      ORDER BY c.category ASC;`,
    [start, end, period],
  );

  const budgets: ICategoryBudgetWithSpent[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    budgets.push(mapRowToBudgetWithSpent(resultSet.rows.item(index)));
  }
  return budgets;
};

/**
 * Same joined shape as `getCategoryBudgets`, for exactly one category's
 * budget in one month. Returns `null` if no budget is defined for that
 * `(idCategory, period)` pair — NOT an error; "no limit set for this
 * category this month" is an expected, common state (e.g. rendering a
 * "set a limit" affordance instead of a progress bar).
 *
 * Throws `Error('Invalid period: ...')` if `period` is not `'YYYY-MM'`.
 */
export const getCategoryBudget = async (
  db: SQLiteDatabase,
  idCategory: number,
  period: string,
): Promise<ICategoryBudgetWithSpent | null> => {
  if (!isValidPeriod(period)) {
    throw new Error(`Invalid period: ${period}`);
  }
  const {start, end} = periodToRange(period);

  const [resultSet] = await db.executeSql(
    `SELECT
        cb.id AS id,
        cb.idCategory AS idCategory,
        cb.period AS period,
        cb.limitAmount AS limitAmount,
        cb.createdAt AS createdAt,
        cb.updatedAt AS updatedAt,
        c.id AS categoryId,
        c.category AS categoryName,
        c.icon AS categoryIcon,
        c.type AS categoryType,
        -COALESCE(f.total, 0) AS spent
      FROM category_budgets cb
      JOIN categories c ON c.id = cb.idCategory
      LEFT JOIN (
        SELECT idCategory, SUM(amount) AS total
        FROM finances
        WHERE idCategory IS NOT NULL AND dateCreated >= ? AND dateCreated < ?
        GROUP BY idCategory
      ) f ON f.idCategory = cb.idCategory
      WHERE cb.idCategory = ? AND cb.period = ?;`,
    [start, end, idCategory, period],
  );

  if (resultSet.rows.length === 0) {
    return null;
  }
  return mapRowToBudgetWithSpent(resultSet.rows.item(0));
};
