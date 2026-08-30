/**
 * Migration `user_version` 5.
 *
 * Slice B5 — Presupuestos. Ships THREE new tables. Nothing here touches
 * `accounts`/`finances`/`categories` — every statement below is a fresh
 * `CREATE TABLE`/`CREATE INDEX`, so (unlike migrations 2 and 4) there is
 * no recreate-and-copy dance and no `PRAGMA foreign_keys` toggling: new
 * tables can declare `FOREIGN KEY`/`CHECK` constraints straight away and
 * have them validated on every `INSERT`/`UPDATE` from day one, on every
 * SQLite version this project has ever had to worry about (the version-
 * gated concerns in migrations 2/4 were specifically about a `CHECK`
 * added via `ALTER TABLE` to a table that could already have rows, or a
 * `DROP COLUMN` — neither applies to a brand-new table).
 *
 * ## Product decision this migration encodes (from the task brief, not
 * this agent's call): a "budget" is two independent things, each with
 * its own table, because they answer different questions and must not be
 * conflated:
 *
 * 1. `envelopes` + `envelope_movements` — "sobres": FONDOS (ahorro,
 *    emergencia, vacaciones) and DEUDAS (préstamo estudiantil). Each has
 *    its own running balance, built by assigning money to it and
 *    consuming it over time. Answers "cuánto tengo apartado".
 * 2. `category_budgets` — a monthly spending ceiling per category
 *    ("máximo $300 en Food este mes"), read back against what was
 *    ACTUALLY spent in `finances` for that category/month. Answers
 *    "cuánto llevo gastado".
 *
 * ## THE decision this agent was explicitly told to follow, not
 * relitigate: an envelope APARTA money, it does not MOVE it
 *
 * Assigning money to an envelope (`envelope_movements`, positive amount)
 * NEVER writes to `accounts` or `finances`, and therefore never changes
 * any account's derived balance or the app's net worth
 * (`getNetWorth` in `src/db/queries/accountsQueries.ts`). An envelope's
 * balance is its OWN derived value —
 * `SUM(envelope_movements.amount) WHERE idEnvelope = envelopes.id` —
 * entirely separate machinery from `initialBalance + SUM(finances.amount)`.
 * `envelope_movements` has no `idAccount` and no `FOREIGN KEY` to
 * `finances` anywhere in this schema; the two ledgers are not linked at
 * the DB level at all. See `src/db/queries/envelopesQueries.ts`'s
 * top-of-file doc for the full rationale (already-approved prototype
 * literally says "Apartado $2.400"; it is additive if a later slice
 * decides envelopes should move real money after all) and for the one
 * consequence of this choice this agent DID have to resolve on its own
 * (see next section) rather than the product decision itself, which is
 * unchanged.
 *
 * ## Resolved by this agent (flagged for review, per the task brief): can
 * you assign more to envelopes than actually exists in your accounts?
 *
 * Nothing in this schema can prevent it — a `CHECK` constraint cannot
 * reference another table's aggregate in SQLite, and the whole point of
 * "aparta, no mueve" is that `envelope_movements` is intentionally
 * decoupled from `accounts`/`finances`. Three options existed: silently
 * ignore it, hard-reject it, or allow it with a non-blocking signal. This
 * agent chose the third — ALLOWED, WITH A SIGNAL, NEVER BLOCKED — same
 * policy applied symmetrically to withdrawals (can you consume more from
 * an envelope than it currently holds? also allowed, also signalled, also
 * never blocked). Full rationale in
 * `src/db/queries/envelopesQueries.ts` next to `assignToEnvelope`/
 * `withdrawFromEnvelope`, which is where a future reviewer should look to
 * reconsider this if the answer above is wrong. In short: hard-rejecting
 * would re-couple the envelope model to real-time account state, which is
 * the exact coupling the "aparta, no mueve" decision exists to avoid, and
 * over-allocation ("assign next month's expected paycheck to a fund
 * today") is a normal, legitimate planning use of an envelope system, not
 * a data-integrity error.
 *
 * ## 1. `envelopes`
 *
 * - `id` — surrogate key, `AUTOINCREMENT`, same convention as every other
 *   table.
 * - `name TEXT NOT NULL` — "Emergencia", "Vacaciones", "Préstamo
 *   estudiantil". No `UNIQUE`, same reasoning as `accounts.name`: nothing
 *   in this product requires it, and inventing that constraint is not
 *   this slice's call.
 * - `icon TEXT NOT NULL` — same free-form icon-name convention as
 *   `accounts.icon`/`categories.icon`.
 * - `kind TEXT NOT NULL CHECK (kind IN ('fund', 'debt'))` — the Fondo/
 *   Deuda discriminator. Safe as a `CHECK` for the same "brand-new table,
 *   INSERT/UPDATE-time only, no ALTER, no pre-existing rows" reason
 *   `accounts.kind` documents in migration 4. Application layer
 *   (`isValidEnvelopeKind` in `src/db/queries/envelopesQueries.ts`) also
 *   validates, belt-and-suspenders, same as every other `kind`/`type`
 *   column in this schema.
 * - `targetAmount INTEGER` (nullable), cents:
 *   - For `kind = 'debt'`: the ORIGINAL amount owed, fixed at creation.
 *     REQUIRED — `CHECK (kind <> 'debt' OR targetAmount IS NOT NULL)` —
 *     because a debt's payoff progress ("cuánto se ha pagado de cuánto")
 *     is meaningless without a "de cuánto". See
 *     `src/db/queries/envelopesQueries.ts` for exactly how "paid" is
 *     computed from this envelope's WITHDRAWALS.
 *   - For `kind = 'fund'`: an OPTIONAL savings goal (e.g. "meta:
 *     $5,000"), purely informational for a progress bar — never required
 *     by, and never read by, the balance/total-apartado math.
 *   - Either way, `CHECK (targetAmount IS NULL OR targetAmount > 0)` — a
 *     zero or negative target is never meaningful.
 * - `archivedAt TEXT` (nullable) — soft-delete, identical convention and
 *   identical reason to `accounts.archivedAt`: `envelope_movements.
 *   idEnvelope` is a load-bearing FK other rows depend on, so a real
 *   envelope with movement history can never be physically deleted.
 * - `createdAt` / `updatedAt TEXT NOT NULL` — ISO-8601
 *   (`toISOString()`), populated by the application layer, NOT
 *   `DEFAULT CURRENT_TIMESTAMP` — identical reasoning to `accounts`'
 *   columns in migration 4 (that pragma's format does not match this
 *   schema's ISO-8601 convention).
 *
 * ## 2. `envelope_movements`
 *
 * One row per assignment or withdrawal against exactly one envelope —
 * this table IS the envelope's balance ledger; there is no stored
 * "balance" column on `envelopes` for the exact same reason there is none
 * on `accounts` (derived-from-movements, never a mutable cache that can
 * desync from what it is supposed to reflect).
 *
 * - `id` — surrogate key, `AUTOINCREMENT`.
 * - `idEnvelope INTEGER NOT NULL REFERENCES envelopes(id)` — every
 *   movement belongs to exactly one envelope.
 * - `amount INTEGER NOT NULL CHECK (amount <> 0)` — SIGNED cents, same
 *   sign convention as `finances.amount`: positive = an ASSIGNMENT
 *   (money apartado into this envelope), negative = a WITHDRAWAL (money
 *   consumed from it — for a debt envelope, a withdrawal IS a payment
 *   applied against the debt; see `envelopesQueries.ts` for how
 *   "paidAmount"/progress is derived from this). `<> 0` is safe here for
 *   the same "brand-new table" reason as every other `CHECK` in this
 *   migration; a zero-amount movement can never mean anything (it is
 *   neither an assignment nor a withdrawal), so this project's usual
 *   "let the app validate money-shape invariants, not the DB" caution
 *   (see migration 4's write-up on why `finances` itself has NO such
 *   `CHECK`) does not apply — `finances` avoided a `CHECK` because that
 *   table was being RECREATED with copied rows from installs that might
 *   already have a bad value; `envelope_movements` has no such history to
 *   protect, it starts empty.
 * - `dateCreated TEXT NOT NULL` — ISO-8601, same convention as
 *   `finances.dateCreated`; this is the timestamp every date-range/
 *   month-bucket aggregate in `src/db/queries/analyticsQueries.ts` groups
 *   or filters on.
 * - `note TEXT` (nullable) — optional free-text ("Pago de agosto",
 *   "Bono de fin de año"). Never structurally meaningful, purely a label
 *   for the envelope's movement history.
 *
 * No `idAccount` and no `idCategory` column anywhere on this table — by
 * design, per "aparta, no mueve" above.
 *
 * ## 3. `category_budgets`
 *
 * One row per (category, calendar month) spending limit.
 *
 * - `id` — surrogate key, `AUTOINCREMENT`.
 * - `idCategory INTEGER NOT NULL REFERENCES categories(id)` — the
 *   category this limit applies to. Application layer
 *   (`setCategoryBudget` in `src/db/queries/budgetsQueries.ts`) rejects
 *   an `income`-type category here — a spending LIMIT on money coming IN
 *   is not a concept this product has; not encoded as a `CHECK` because a
 *   `CHECK` cannot see another table's column (`categories.type`)
 *   without a subquery, which SQLite `CHECK` constraints do not support.
 * - `period TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-
 *   [0-9][0-9]')` — `'YYYY-MM'`, e.g. `'2026-08'`. Budgets are defined
 *   per CALENDAR MONTH, not an arbitrary date range — the task asked for
 *   "un límite por categoría y mes". A plain string in this fixed shape
 *   both sorts/compares correctly as text (same reasoning
 *   `createFinancesTable.ts` gives for `dateCreated`) and is trivially
 *   converted to a half-open `[start, end)` ISO-8601 range for joining
 *   against `finances.dateCreated` — see `periodToRange` in
 *   `src/db/queries/period.ts`. `GLOB` (not `LIKE`) is used for the shape
 *   check because `GLOB` is case-sensitive/Unix-shell-style pattern
 *   matching that has existed in SQLite's core since its earliest
 *   releases — no version risk, unlike the `ALTER`-time `CHECK`
 *   validation gap migration 2 flags.
 * - `limitAmount INTEGER NOT NULL CHECK (limitAmount > 0)` — cents, same
 *   integer-minor-units convention as every money column in this schema.
 * - `UNIQUE (idCategory, period)` — a category has exactly ONE limit for
 *   a given month; this is a real domain invariant (not a judgement call
 *   like `accounts.name`'s lack of a `UNIQUE`), so it is enforced here.
 *   `setCategoryBudget` (`src/db/queries/budgetsQueries.ts`) does an
 *   explicit `UPDATE` then, if no row matched, an `INSERT` — deliberately
 *   NOT `INSERT ... ON CONFLICT ... DO UPDATE`, which needs SQLite
 *   ≥ 3.24.0 (2018-06). This project has never pinned/verified a minimum
 *   bundled SQLite version (see migrations 2 and 4 for the same caution
 *   applied to `ALTER TABLE` features), and an explicit two-statement
 *   UPDATE-then-INSERT needs nothing newer than SQLite has supported
 *   since its very first release. The `UNIQUE` constraint above is the
 *   safety net if that two-statement dance is ever raced or misused.
 * - `createdAt` / `updatedAt TEXT NOT NULL` — same ISO-8601 convention as
 *   every other timestamp in this schema.
 *
 * ## Indexes — one per real query pattern the new query layer exposes;
 * see `src/db/queries/envelopesQueries.ts`, `budgetsQueries.ts`, and
 * `analyticsQueries.ts` for exactly which function each backs.
 *
 * - `idx_envelopes_active` (`archivedAt`, partial: `WHERE archivedAt IS
 *   NULL`) — `getEnvelopes`' default "active only" filter. Identical
 *   shape to `idx_accounts_active` from migration 4.
 * - `idx_envelopes_kind` (`kind`) — `getEnvelopes({kind})` /
 *   `getEnvelopesTotal({kind})`'s Fondo-vs-Deuda filter (the pie-chart
 *   breakdowns).
 * - `idx_envelope_movements_idEnvelope_amount` (`idEnvelope, amount`) — a
 *   COVERING index for `SUM(amount)` / the paid-amount `SUM(CASE WHEN
 *   amount < 0 ...)` `GROUP BY idEnvelope` every derived-balance read
 *   (`getEnvelopes`/`getEnvelopeById`/`getEnvelopesTotal` in
 *   `envelopesQueries.ts`) runs — same "both touched columns live in the
 *   index" trick as `idx_finances_idAccount_amount` from migration 4.
 * - `idx_envelope_movements_idEnvelope_date` (`idEnvelope, dateCreated
 *   DESC, id DESC`) — `getEnvelopeMovements`' per-envelope keyset
 *   pagination, same pattern as `idx_finances_idAccount_date_id`.
 * - `idx_envelope_movements_date` (`dateCreated`) — the date-range scan
 *   half of `getCashFlowByMonth`'s `UNION ALL` (`src/db/queries/
 *   analyticsQueries.ts`), which sums fund-envelope movements by month
 *   independently of any single `idEnvelope`.
 * - `idx_category_budgets_period` (`period`) — `getCategoryBudgets(
 *   period)`'s "every budget set for this month" listing. The `UNIQUE
 *   (idCategory, period)` constraint above already creates its own
 *   implicit index for the point lookup `setCategoryBudget` needs
 *   (`WHERE idCategory = ? AND period = ?`); this second index exists
 *   because THAT composite index is not usable to satisfy a `period`-only
 *   predicate as its leading column efficiently in every query planner
 *   scenario SQLite might choose — a plain single-column index removes
 *   any doubt for this specific access pattern.
 * - `idx_finances_idCategory_date_amount` (`idCategory, dateCreated,
 *   amount`, partial: `WHERE idCategory IS NOT NULL`) — added on the
 *   EXISTING `finances` table (a new index does not require recreating
 *   the table — no `PRAGMA foreign_keys` toggling needed, unlike an
 *   `ALTER`/recreate). Backs `getCategoryBudgets`' and
 *   `setCategoryBudget`'s per-category "spent in this exact month" join
 *   (`WHERE idCategory = ? AND dateCreated >= ? AND dateCreated < ?`,
 *   summing `amount`): all three touched columns are in the index, so
 *   SQLite can answer it without touching `finances`' actual rows.
 *   Partial (`WHERE idCategory IS NOT NULL`) so the (a fraction of, once
 *   transfers ship real usage) categoryless transfer-leg rows never
 *   enter this index at all — reinforcing, at the index level, the same
 *   rule `IFinanceRow.category`'s doc in `financesQueries.ts` already
 *   states: a spend-by-category aggregate must never silently include a
 *   transfer leg.
 */
export const migration005Statements: string[] = [
  // 1. envelopes
  `CREATE TABLE IF NOT EXISTS envelopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('fund', 'debt')),
    targetAmount INTEGER
      CHECK (targetAmount IS NULL OR targetAmount > 0)
      CHECK (kind <> 'debt' OR targetAmount IS NOT NULL),
    archivedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_envelopes_active ON envelopes(archivedAt) WHERE archivedAt IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_envelopes_kind ON envelopes(kind);`,

  // 2. envelope_movements
  `CREATE TABLE IF NOT EXISTS envelope_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idEnvelope INTEGER NOT NULL,
    amount INTEGER NOT NULL CHECK (amount <> 0),
    dateCreated TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (idEnvelope) REFERENCES envelopes(id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_envelope_movements_idEnvelope_amount ON envelope_movements(idEnvelope, amount);`,
  `CREATE INDEX IF NOT EXISTS idx_envelope_movements_idEnvelope_date ON envelope_movements(idEnvelope, dateCreated DESC, id DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_envelope_movements_date ON envelope_movements(dateCreated);`,

  // 3. category_budgets
  `CREATE TABLE IF NOT EXISTS category_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idCategory INTEGER NOT NULL,
    period TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    limitAmount INTEGER NOT NULL CHECK (limitAmount > 0),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (idCategory) REFERENCES categories(id),
    UNIQUE (idCategory, period)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_category_budgets_period ON category_budgets(period);`,

  // 4. new index on the EXISTING finances table — no recreate needed.
  `CREATE INDEX IF NOT EXISTS idx_finances_idCategory_date_amount ON finances(idCategory, dateCreated, amount) WHERE idCategory IS NOT NULL;`,
];
