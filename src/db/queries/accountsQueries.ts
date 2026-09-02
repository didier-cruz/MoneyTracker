import {SQLiteDatabase} from 'react-native-sqlite-storage';
import {isFiniteInteger} from './numberGuards';

/**
 * `accounts` columns are `id` / `name` / `icon` / `kind` /
 * `initialBalance` / `archivedAt` / `createdAt` / `updatedAt` — see
 * `src/db/migrations/004_accountsAndSignedFinances.ts` for the full
 * column-by-column rationale.
 *
 * `kind` distinguishes the four account shapes this product needs today:
 * - `cash` — physical money, no institution behind it.
 * - `bank` — a checking/savings account at a bank.
 * - `credit_card` — a credit line; expected to carry a NEGATIVE derived
 *   balance in normal use (money owed), which is why this schema never
 *   forbids negative balances anywhere.
 * - `loan` — a financing the user OWES: a personal loan, an
 *   "extrafinanciamiento", a mortgage. Like `credit_card` it is
 *   expected to carry a NEGATIVE derived balance (money owed), but it
 *   is its own kind because the two are not the same instrument: a loan
 *   has principal, term and a fixed installment, a card is a revolving
 *   line. Paying an installment is a transfer INTO this account
 *   (reducing what is owed); the interest of that installment is an
 *   ordinary EXPENSE against it (increasing it), which is what makes
 *   net worth move by the interest alone and not by the principal —
 *   paying principal moves money, it does not make the user poorer.
 * - `receivable` — money a third party owes the user ("Juan me debe").
 *   Modeled as an account, not a separate module: lending money to them
 *   is a transfer INTO this account (slice B3), each repayment a
 *   transfer back OUT of it. A positive balance here means the third
 *   party still owes that amount.
 */
export type AccountKind = 'cash' | 'bank' | 'credit_card' | 'loan' | 'receivable';

export const ACCOUNT_KINDS: readonly AccountKind[] = [
  'cash',
  'bank',
  'credit_card',
  'loan',
  'receivable',
] as const;

const isValidAccountKind = (kind: string): kind is AccountKind =>
  (ACCOUNT_KINDS as readonly string[]).includes(kind);

/**
 * One account row as stored, with NO derived balance — used internally
 * and exported for callers that only need identity/metadata (e.g.
 * resolving `finances.idAccount` to a display name) without paying for
 * the aggregate join `IAccountWithBalance` requires.
 */
export interface IAccount {
  id: number;
  name: string;
  icon: string;
  kind: AccountKind;
  /** Cents. The account's balance BEFORE any `finances` row — never the
   * current balance; see `IAccountWithBalance.balance` for that. */
  initialBalance: number;
  /** ISO-8601 timestamp, or `null` if the account is active (not archived). */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `IAccount` plus its DERIVED current balance:
 * `initialBalance + SUM(finances.amount WHERE idAccount = id)`, computed
 * at read time by `getAccounts`/`getAccountById`. This value is NEVER
 * stored — there is no mutable "balance" column anywhere in this schema,
 * by explicit product decision (see the migration file). Cents.
 */
export interface IAccountWithBalance extends IAccount {
  balance: number;
}

export interface IInsertAccountInput {
  name: string;
  icon: string;
  kind: AccountKind;
  /** Cents. Defaults to 0. */
  initialBalance?: number;
  /** ISO-8601. Defaults to `new Date().toISOString()` if omitted. */
  createdAt?: string;
  /** ISO-8601. Defaults to `new Date().toISOString()` if omitted. */
  updatedAt?: string;
}

export interface IUpdateAccountInput {
  name?: string;
  icon?: string;
  kind?: AccountKind;
  /** Cents. Editing this retroactively shifts the account's derived
   * balance — this is a deliberate correction tool (e.g. "I set up this
   * account with the wrong opening balance"), not a hidden side channel
   * for recording a transaction; movements still belong in `finances`. */
  initialBalance?: number;
}

export interface IGetAccountsOptions {
  /** Defaults to `false` — archived accounts are excluded unless asked for. */
  includeArchived?: boolean;
}

const mapRowToAccountWithBalance = (row: any): IAccountWithBalance => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  kind: row.kind,
  initialBalance: row.initialBalance,
  archivedAt: row.archivedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  balance: row.balance,
});

/**
 * Shared SELECT for every read below: joins each account to a
 * per-account `SUM(amount)` computed over `finances`, so `balance` is
 * always `initialBalance + COALESCE(SUM(amount), 0)` — an account with
 * zero movements still returns a balance (its `initialBalance`), not
 * `NULL`. The subquery is backed by the covering index
 * `idx_finances_idAccount_amount(idAccount, amount)` (see the
 * migration), so SQLite can answer `GROUP BY idAccount` from the index
 * alone, never touching `finances`' actual rows.
 */
const ACCOUNTS_WITH_BALANCE_SELECT = `
  SELECT
    a.id AS id,
    a.name AS name,
    a.icon AS icon,
    a.kind AS kind,
    a.initialBalance AS initialBalance,
    a.archivedAt AS archivedAt,
    a.createdAt AS createdAt,
    a.updatedAt AS updatedAt,
    a.initialBalance + COALESCE(f.total, 0) AS balance
  FROM accounts a
  LEFT JOIN (
    SELECT idAccount, SUM(amount) AS total FROM finances GROUP BY idAccount
  ) f ON f.idAccount = a.id
`;

/**
 * Inserts one account.
 *
 * Throws:
 * - `Error('Invalid account kind: ...')` if `kind` is not one of
 *   `ACCOUNT_KINDS` — defense in depth alongside the DB's own
 *   `CHECK (kind IN (...))` constraint (see the migration for why that
 *   `CHECK` is safe here, unlike `categories.type`).
 * - `Error('initialBalance must be an integer number of cents')` if
 *   `initialBalance` is passed and is not a safe integer.
 *
 * Returns the new row's `id` (from `insertId`), not the full row.
 */
export const insertAccount = async (
  db: SQLiteDatabase,
  input: IInsertAccountInput,
): Promise<{id: number}> => {
  if (!isValidAccountKind(input.kind)) {
    throw new Error(`Invalid account kind: ${input.kind}`);
  }
  const initialBalance = input.initialBalance ?? 0;
  if (!isFiniteInteger(initialBalance)) {
    throw new Error('initialBalance must be an integer number of cents');
  }
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;

  const [result] = await db.executeSql(
    `INSERT INTO accounts (name, icon, kind, initialBalance, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [input.name, input.icon, input.kind, initialBalance, createdAt, updatedAt],
  );
  return {id: result.insertId};
};

/**
 * Partially updates an account's identity/opening-balance fields.
 * `undefined` fields are left untouched; passing no fields at all is a
 * no-op (no `UPDATE` is issued). Always bumps `updatedAt` to now when at
 * least one field changes.
 *
 * The `SET` clause is built from a fixed, hardcoded list of column
 * names, never from caller input — only the VALUES are parameterized —
 * so this cannot become a SQL-injection vector despite being "dynamic".
 *
 * Throws the same `kind`/`initialBalance` validation errors as
 * `insertAccount` if those fields are passed and invalid.
 */
export const updateAccount = async (
  db: SQLiteDatabase,
  id: number,
  input: IUpdateAccountInput,
): Promise<void> => {
  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (input.name !== undefined) {
    sets.push('name = ?');
    params.push(input.name);
  }
  if (input.icon !== undefined) {
    sets.push('icon = ?');
    params.push(input.icon);
  }
  if (input.kind !== undefined) {
    if (!isValidAccountKind(input.kind)) {
      throw new Error(`Invalid account kind: ${input.kind}`);
    }
    sets.push('kind = ?');
    params.push(input.kind);
  }
  if (input.initialBalance !== undefined) {
    if (!isFiniteInteger(input.initialBalance)) {
      throw new Error('initialBalance must be an integer number of cents');
    }
    sets.push('initialBalance = ?');
    params.push(input.initialBalance);
  }

  if (sets.length === 0) {
    return;
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(id);

  await db.executeSql(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, params);
};

/**
 * Soft-deletes an account by stamping `archivedAt`. Idempotent — a
 * second call on an already-archived account is a no-op (the `WHERE
 * archivedAt IS NULL` guard means zero rows are affected, not an error).
 *
 * Accounts are NEVER physically deleted: `finances.idAccount` is a
 * `NOT NULL FOREIGN KEY` to this table, so a real account with
 * transaction history cannot be dropped without either violating that
 * constraint or orphaning history. Archiving hides it from
 * `getAccounts`' default view instead.
 */
export const archiveAccount = async (
  db: SQLiteDatabase,
  id: number,
  archivedAt?: string,
): Promise<void> => {
  const resolved = archivedAt ?? new Date().toISOString();
  await db.executeSql(
    'UPDATE accounts SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL',
    [resolved, resolved, id],
  );
};

/**
 * Reverses `archiveAccount`: clears `archivedAt`, restoring the account
 * to `getAccounts`' default (active) view. Idempotent — a second call on
 * an already-active account is a no-op (the `WHERE archivedAt IS NOT
 * NULL` guard means zero rows are affected, not an error), symmetric
 * with `archiveAccount`'s own idempotency.
 *
 * A dedicated function rather than widening `updateAccount`'s
 * whitelist: `archivedAt` is a lifecycle/soft-delete flag with its own
 * idempotent guard clause, not a plain field edit like `name`/`icon` —
 * conflating it with `IUpdateAccountInput` would mean threading
 * `archivedAt?: string | null` through a generic SET-builder that has
 * no notion of "only if currently archived/active", losing that
 * guarantee. Mirroring `archiveAccount` 1:1 keeps both operations next
 * to each other with matching signatures.
 *
 * Net worth effect: `getNetWorth` and the default `getAccounts` view
 * only ever include ACTIVE accounts, so restoring an account moves its
 * derived balance (which was frozen, not zeroed, while archived) back
 * into net worth on the next read — a credit-card account restored with
 * a negative balance will pull net worth down, same as a positive
 * balance pulls it up. No balances are recomputed or written here; the
 * account's own transaction history in `finances` was never touched by
 * archiving in the first place, so nothing needs reconciling.
 */
export const unarchiveAccount = async (db: SQLiteDatabase, id: number): Promise<void> => {
  const now = new Date().toISOString();
  await db.executeSql(
    'UPDATE accounts SET archivedAt = NULL, updatedAt = ? WHERE id = ? AND archivedAt IS NOT NULL',
    [now, id],
  );
};

/**
 * Lists accounts (active only, by default) with their DERIVED balance —
 * see `ACCOUNTS_WITH_BALANCE_SELECT`. Ordered by `name` for a stable,
 * predictable UI list; this table is expected to stay small (a handful
 * to a few dozen rows per user), so no pagination/index beyond
 * `idx_accounts_active` is warranted.
 *
 * Pass `{includeArchived: true}` to also get hidden/archived accounts
 * (e.g. an "archived accounts" management screen).
 */
export const getAccounts = async (
  db: SQLiteDatabase,
  opts: IGetAccountsOptions = {},
): Promise<IAccountWithBalance[]> => {
  const whereClause = opts.includeArchived ? '' : 'WHERE a.archivedAt IS NULL';
  const [resultSet] = await db.executeSql(
    `${ACCOUNTS_WITH_BALANCE_SELECT} ${whereClause} ORDER BY a.name ASC;`,
  );

  const accounts: IAccountWithBalance[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    accounts.push(mapRowToAccountWithBalance(resultSet.rows.item(index)));
  }
  return accounts;
};

/**
 * Same derived-balance shape as `getAccounts`, for exactly one account
 * (archived or not — a single-account detail screen needs to work even
 * for an archived account). Returns `null` if no such account exists.
 */
export const getAccountById = async (
  db: SQLiteDatabase,
  id: number,
): Promise<IAccountWithBalance | null> => {
  const [resultSet] = await db.executeSql(
    `${ACCOUNTS_WITH_BALANCE_SELECT} WHERE a.id = ?;`,
    [id],
  );
  if (resultSet.rows.length === 0) {
    return null;
  }
  return mapRowToAccountWithBalance(resultSet.rows.item(0));
};

/**
 * Net worth: the sum of every ACTIVE account's derived balance
 * (archived accounts are excluded — they are treated as no longer part
 * of the user's tracked money). Cents.
 *
 * A single query rather than `(await getAccounts(db)).reduce(...)` so
 * the sum is computed inside SQLite (one pass over the same
 * covering-index-backed aggregate `getAccounts` uses) instead of
 * fetching every account row into JS just to add them up.
 */
export const getNetWorth = async (db: SQLiteDatabase): Promise<number> => {
  const [resultSet] = await db.executeSql(
    `SELECT COALESCE(SUM(a.initialBalance + COALESCE(f.total, 0)), 0) AS netWorth
      FROM accounts a
      LEFT JOIN (
        SELECT idAccount, SUM(amount) AS total FROM finances GROUP BY idAccount
      ) f ON f.idAccount = a.id
      WHERE a.archivedAt IS NULL;`,
  );
  return resultSet.rows.item(0).netWorth;
};
