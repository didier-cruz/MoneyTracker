/**
 * Migration `user_version` 4.
 *
 * Introduces `accounts` and turns `finances` into a ledger of movements
 * against an account, per slice B2. Three things ship together because
 * they are one migration of the same table graph and cannot be split
 * without leaving `finances` in an invalid intermediate state:
 *
 * 1. NEW TABLE `accounts` — cash / bank / credit card / receivable
 *    "buckets" a movement can belong to. A loan to a third party ("Juan
 *    me debe") is modeled as a `receivable` account, not a separate
 *    module — lending is a transfer INTO it (wired in slice B3), each
 *    repayment a transfer back OUT of it.
 *
 *    Columns:
 *    - `id` — surrogate key, `AUTOINCREMENT`, same convention as every
 *      other table in this schema.
 *    - `name TEXT NOT NULL` — user-facing label ("Efectivo", "BBVA",
 *      "Visa Oro", "Juan"). No `UNIQUE` constraint: nothing in this
 *      product requires account names to be unique (two different cash
 *      accounts, or two people who owe money, could legitimately share a
 *      label), and inventing that constraint here is not this slice's
 *      call to make.
 *    - `icon TEXT NOT NULL` — same free-form icon-name convention as
 *      `categories.icon`, resolved by the FE the same way.
 *    - `kind TEXT NOT NULL CHECK (kind IN ('cash','bank','credit_card',
 *      'receivable'))` — the discriminator the task asked for. A `CHECK`
 *      IS safe here, unlike `categories.type` in migration 2: that one
 *      was an `ALTER TABLE ... ADD COLUMN ... CHECK` retroactively
 *      validated against rows that could already exist, which SQLite
 *      only does since 3.37.0 (a version this project has never
 *      pinned/verified). `accounts` is a table created for the very
 *      first time by THIS statement — there is no such thing as a
 *      pre-existing row for the `CHECK` to be retroactively evaluated
 *      against; every row, including the one seeded a few statements
 *      below, is validated by a normal `INSERT`-time `CHECK`, which
 *      every SQLite version has always supported. The application layer
 *      (`isValidAccountKind` in `src/db/queries/accountsQueries.ts`)
 *      still validates too, defense-in-depth, exactly like
 *      `isValidCategoryType` does for `categories.type` — but here it is
 *      belt-AND-suspenders, not a substitute for a constraint SQLite
 *      cannot safely enforce.
 *    - `initialBalance INTEGER NOT NULL DEFAULT 0` — cents, same
 *      integer-minor-units convention as `finances.finance` (see
 *      `src/db/creation/createFinancesTable.ts`). This is the ONLY
 *      balance value ever stored: an account's current balance is
 *      ALWAYS `initialBalance + SUM(finances.amount WHERE idAccount =
 *      accounts.id)`, computed at read time, never written back to a
 *      stored column. The user chose this explicitly — a cached/mutable
 *      balance column desyncing from its movements is the single most
 *      expensive failure mode in a money app, and a derived value simply
 *      cannot desync from the movements it is derived from.
 *    - `archivedAt TEXT` (nullable) — soft-delete. An account with
 *      historical `finances` rows pointing at it can never be physically
 *      deleted (its `id` is load-bearing FK state other rows depend on),
 *      so "removing" an account from the UI means hiding it, not
 *      dropping it. `NULL` = active; a non-null ISO-8601 timestamp
 *      records both "hidden" and "since when", which a plain boolean
 *      flag would not.
 *    - `createdAt` / `updatedAt TEXT NOT NULL` — same ISO-8601
 *      (`toISOString()`) convention as `finances.dateCreated`, populated
 *      by the application layer (`insertAccount`/`updateAccount`
 *      default to `new Date().toISOString()` when omitted), NOT by a
 *      SQLite `DEFAULT CURRENT_TIMESTAMP` — that pragma produces
 *      `YYYY-MM-DD HH:MM:SS` (UTC, space separator, no `T`/`Z`/millis),
 *      a different string format than every other timestamp this schema
 *      stores, which would silently break lexicographic sort/compare
 *      consistency across tables.
 *
 * 2. BACKFILL — reassigning any real, pre-existing `finances` rows to a
 *    seeded default account before `idAccount` can become `NOT NULL`.
 *
 *    Unlike migration 2 (where `finances` was provably empty in every
 *    install — no insert path had ever shipped), migration 3 shipped a
 *    working `insertFinance`, so real user rows CAN exist by the time an
 *    install reaches this migration. Adding a `NOT NULL` column with a
 *    `FOREIGN KEY` to a table that may already have rows requires
 *    resolving every existing row's value for that column BEFORE the
 *    constraint takes effect — there is no such thing as "add the column
 *    now, backfill it later" for a `NOT NULL FOREIGN KEY` column created
 *    via the table-recreate pattern (the copy-`INSERT` itself is what
 *    the constraint applies to).
 *
 *    Procedure, in the exact order below:
 *    a. Create `accounts` (so a row can be inserted into it).
 *    b. Insert exactly ONE seeded account — name "Efectivo", kind
 *       `cash`, `initialBalance` 0 — and capture ITS id via
 *       `last_insert_rowid()` into a session-local `TEMP` table
 *       (`_default_account`), the same "snapshot a fact once, before
 *       further statements can change it" pattern migration 3 used for
 *       `_seed_guard`. The id is captured rather than assumed to be `1`:
 *       `accounts` is brand new so it WILL be `1` in practice, but
 *       reading it back via `last_insert_rowid()` costs nothing and
 *       removes any dependency on that assumption ever holding.
 *       Every pre-existing `finances` row is reassigned to this one
 *       account. This is a judgement call, not a derivation — there is
 *       no way to recover which real-world account a historical
 *       transaction actually belonged to, because no such concept
 *       existed before this migration. It is flagged here exactly like
 *       migration 2 flagged defaulting `categories.type` to `'expense'`
 *       for the same reason: product/FE may want a one-time "review
 *       your transactions' accounts" pass later.
 *    c. Recreate `finances` (see part 3) copying every existing row,
 *       assigning `idAccount = (SELECT id FROM _default_account)` and
 *       deriving `amount`'s sign from a `LEFT JOIN` to
 *       `categories.type` at copy time (`expense` → negative, `income`
 *       → positive; a missing/unrecognized category type — should not
 *       happen, `idCategory` was `NOT NULL` with an enforced FK — is
 *       defensively treated as `expense`, the safer direction: it
 *       undercounts rather than overcounts money the user has).
 *       No row is dropped: the copy is an unconditional `INSERT ...
 *       SELECT` over every row of the old table, same row count in as
 *       out.
 *    d. Drop `_default_account` once the copy is done — it is a `TEMP`
 *       table, session-local, never part of the persisted schema; nothing
 *       else needs to know about or drop it later.
 *
 * 3. `finances` SCHEMA CHANGE — bundled into THIS migration rather than
 *    left for slice B3, specifically so this table is not migrated twice
 *    in a row:
 *    - `finance` renamed to `amount` (contained rename: nothing outside
 *      `src/db/queries/financesQueries.ts` reads the raw column name —
 *      verified by grep — the rest of the app already only ever sees the
 *      `IFinanceRow.amount` field the query layer aliases it to).
 *    - `amount` becomes SIGNED: negative = money leaving the account,
 *      positive = money entering it. This is exactly what makes
 *      `initialBalance + SUM(amount)` a correct derived balance instead
 *      of needing a per-row "is this a debit or credit" lookup at read
 *      time.
 *    - `idAccount INTEGER NOT NULL REFERENCES accounts(id)` — every
 *      movement now belongs to exactly one account. Required, not
 *      optional: a finance row that belongs to no account cannot
 *      contribute to any account's derived balance, which would defeat
 *      the entire point of this slice.
 *    - `idCategory` becomes NULLABLE — a transfer's two legs (slice B3)
 *      move money between two accounts and are not "an expense" or "an
 *      income" in the categorized sense; they have no category.
 *    - `transferGroupId TEXT` (nullable) — added now, unused by any
 *      query in this slice, purely so `finances` does not need a THIRD
 *      recreation when slice B3 implements transfers. It will hold a
 *      value shared by a transfer's two legs (the outgoing row at the
 *      source account and the incoming row at the destination account),
 *      letting them be found/undone together. `NULL` for every
 *      non-transfer row (today, every row).
 *
 *    Recreate pattern: same one migration 2 already established for
 *    this exact table — `PRAGMA foreign_keys = OFF` for the duration
 *    (never inside an open transaction; every statement here runs
 *    autocommit, one `executeSql` call at a time, so toggling the pragma
 *    between statements is safe — see `src/db/db.ts`'s own note on why
 *    the pragma cannot change mid-transaction), create the new table
 *    under a temp name (`finances_v3` — `finances_v2` was migration 2's
 *    name, already retired), copy rows across an explicit column list,
 *    drop the old table, rename the new one into place, pragma back ON.
 *    No `CHECK` constraint is added to the new `finances` (e.g. an
 *    `amount <> 0` invariant would be tempting) even though — unlike
 *    `categories.type` — it would carry no SQLite-version risk (this is
 *    also a fresh `CREATE TABLE`, not an `ALTER`): the risk here is
 *    different. A `CHECK` is enforced during the copy-`INSERT` itself,
 *    so if any real install ever has a stray zero-amount row (nothing
 *    upstream currently guarantees `finance <> 0` today, only
 *    `useFormScreen`'s form validation, which is UI, not a DB
 *    constraint), a hard `CHECK` would abort THIS MIGRATION for that
 *    install with no recovery path other than manual DB surgery, instead
 *    of `insertFinance` simply rejecting the bad value going forward
 *    (which it already does — see `src/db/queries/financesQueries.ts`).
 *    App-level validation was already this project's chosen tool for
 *    invariants that are safe to enforce prospectively but risky to
 *    enforce retroactively during a migration.
 *
 * 4. INDEXES — recreated from scratch (dropping `finances` drops its old
 *    indexes with it; migration 2's `idx_finances_date_id` and
 *    `idx_finances_idCategory` must be redefined here), plus new ones for
 *    the aggregation and per-account access patterns this slice adds:
 *    - `idx_finances_date_id` — unchanged from migration 2: the global
 *      newest-first keyset feed `getFinances` uses when not filtered to
 *      one account.
 *    - `idx_finances_idCategory` — unchanged from migration 2: filtering
 *      `getFinances` by category.
 *    - `idx_finances_idAccount_amount` (`idAccount, amount`) — a
 *      COVERING index for `SUM(amount) GROUP BY idAccount`, the query
 *      every derived-balance read (`getAccounts`/`getAccountById`/
 *      `getNetWorth` in `src/db/queries/accountsQueries.ts`) runs.
 *      Because both columns the aggregate touches are in the index,
 *      SQLite can answer it by scanning the index alone, never touching
 *      the `finances` table's actual rows.
 *    - `idx_finances_idAccount_date_id` (`idAccount, dateCreated DESC,
 *      id DESC`) — the per-account equivalent of `idx_finances_date_id`,
 *      for `getFinances({idAccount})`'s keyset pagination (a per-account
 *      transaction history screen).
 *    - `idx_finances_transferGroupId` (partial: `WHERE transferGroupId
 *      IS NOT NULL`) — unused by any query in THIS slice, added now for
 *      the same "don't re-migrate `finances` a third time" reason as the
 *      column itself. Partial so the (today: 100% of rows) `NULL` case
 *      costs nothing to index.
 *    - `idx_accounts_active` (`archivedAt`, partial: `WHERE archivedAt
 *      IS NULL`) — backs `getAccounts`' default "active accounts only"
 *      filter.
 */
export const migration004Statements: string[] = [
  // 1. accounts
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('cash', 'bank', 'credit_card', 'receivable')),
    initialBalance INTEGER NOT NULL DEFAULT 0,
    archivedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,

  // 2. Seed exactly one default account to reassign pre-existing
  // `finances` rows to, and capture its id (see the write-up above for
  // why this is captured via `last_insert_rowid()` rather than assumed).
  // The literal timestamp below is this migration's own ship date — a
  // fixed historical fact, not a runtime `new Date()` call, for the same
  // "a migration's behavior must never depend on anything that can
  // change after it ships" reason migration 3 documents at length.
  `INSERT INTO accounts (name, icon, kind, initialBalance, createdAt, updatedAt)
    VALUES ('Efectivo', 'money', 'cash', 0, '2026-08-29T00:00:00.000Z', '2026-08-29T00:00:00.000Z');`,
  `CREATE TEMP TABLE _default_account AS SELECT last_insert_rowid() AS id;`,

  // 3. Recreate `finances` with the new signed/accounted shape, backfilling
  // every existing row onto the seeded default account above, deriving
  // its sign from its category's type.
  `PRAGMA foreign_keys = OFF;`,
  `CREATE TABLE finances_v3 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount INTEGER NOT NULL,
    dateCreated TEXT NOT NULL,
    idAccount INTEGER NOT NULL,
    idCategory INTEGER,
    transferGroupId TEXT,
    FOREIGN KEY (idAccount) REFERENCES accounts(id),
    FOREIGN KEY (idCategory) REFERENCES categories(id)
  );`,
  `INSERT INTO finances_v3 (id, amount, dateCreated, idAccount, idCategory)
    SELECT
      f.id,
      CASE WHEN c.type = 'income' THEN ABS(f.finance) ELSE -ABS(f.finance) END,
      f.dateCreated,
      (SELECT id FROM _default_account),
      f.idCategory
    FROM finances f
    LEFT JOIN categories c ON c.id = f.idCategory;`,
  `DROP TABLE finances;`,
  `ALTER TABLE finances_v3 RENAME TO finances;`,
  `PRAGMA foreign_keys = ON;`,

  `DROP TABLE _default_account;`,

  // 4. Indexes
  `CREATE INDEX IF NOT EXISTS idx_finances_date_id ON finances(dateCreated DESC, id DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_finances_idCategory ON finances(idCategory);`,
  `CREATE INDEX IF NOT EXISTS idx_finances_idAccount_amount ON finances(idAccount, amount);`,
  `CREATE INDEX IF NOT EXISTS idx_finances_idAccount_date_id ON finances(idAccount, dateCreated DESC, id DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_finances_transferGroupId ON finances(transferGroupId) WHERE transferGroupId IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(archivedAt) WHERE archivedAt IS NULL;`,
];
