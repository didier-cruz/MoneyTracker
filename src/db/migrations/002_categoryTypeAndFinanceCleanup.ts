/**
 * Migration `user_version` 2.
 *
 * Ships three related changes, all decided for this slice:
 *
 * 1. `categories.type` — the income/expense discriminator now lives as a
 *    column on `categories` (matches the global `ICategory` interface,
 *    the `src/data/categories.ts` seed, and the Expenses/Incomes tabs
 *    that list categories split by type).
 *
 *    Added via `ALTER TABLE ... ADD COLUMN` (categories already shipped
 *    in migration 1 — see `src/db/creation/createCategoriesTable.ts`,
 *    which must NOT be edited: installs that already ran version 1 will
 *    never re-run it).
 *
 *    - `NOT NULL DEFAULT 'expense'`: every pre-existing row (any category
 *      created via `insertCategory` before this slice) has no recorded
 *      type — `insertCategory` never took one. There is no way to
 *      recover the "real" type for those rows after the fact, so a
 *      default has to be chosen. `'expense'` is used because expense
 *      categories are both the more common case for a personal-finance
 *      app and the first tab a user lands on; it is a judgement call,
 *      not a derivation, and it is flagged here so product/FE can offer
 *      a one-time "review your categories" pass if that data quality gap
 *      matters later.
 *    - No `CHECK` constraint restricting values to `income`/`expense` is
 *      added here. SQLite only validates a new column's `CHECK`
 *      constraint against pre-existing rows (rather than silently
 *      accepting them) since version 3.37.0 (2021-11-27) — see
 *      https://www.sqlite.org/lang_altertable.html. This project has no
 *      pinned/verified minimum SQLite version bundled by
 *      `react-native-sqlite-storage` across the OS/device matrix it
 *      ships to, so depending on that behavior is a risk not worth
 *      taking for a constraint that the application already enforces
 *      (the `'income' | 'expense'` union type on `insertCategory`'s
 *      `type` parameter, validated at runtime in
 *      `src/db/queries/categoriesQueries.ts`). If a future slice wants a
 *      DB-level `CHECK` here, the safe path is the table-recreate
 *      pattern used below for `finances`, not a bare `ALTER TABLE`.
 *
 * 2. Drop `finances.idType` (and the `types` lookup table it referenced).
 *    See the HANDOFF for the redundancy argument. In short: once a
 *    finance row carries `idCategory`, and `categories.type` gives the
 *    income/expense discriminator, `idType` duplicates state that must
 *    now be kept in sync by hand across two tables — a divergence bug
 *    waiting to happen (a finance row's `idType` disagreeing with its
 *    own category's `type`). Nothing in the codebase ever seeded or
 *    queried `types` (`grep` across `src/` before this migration shows
 *    zero call sites for `insertType`/`getTypes` outside
 *    `src/db/queries/typesQueries.ts` itself), so there is no legitimate
 *    second use being given up.
 *
 *    SQLite's `ALTER TABLE ... DROP COLUMN` only exists since 3.35.0
 *    (2021-03-12) and, like the `CHECK` case above, this project has no
 *    verified minimum bundled SQLite version — so this migration does
 *    NOT call `DROP COLUMN`. Instead it uses SQLite's own documented
 *    "make other kinds of table schema changes" recipe (safe on every
 *    SQLite version): recreate the table under a temp name without the
 *    column, copy any existing rows across explicit column lists, drop
 *    the old table, rename the new one into place, foreign keys
 *    disabled for the duration. `finances` is additionally provably
 *    empty in every install at the time this migration ships — no
 *    `INSERT INTO finances` has ever shipped in this codebase (there was
 *    no `financesQueries.ts` before this slice, and the table itself was
 *    never even created before the previous slice's migration-runner
 *    fix) — but the row-copy step is kept anyway as defensive practice:
 *    if that assumption is ever wrong for some install, data still
 *    survives the migration instead of being silently dropped.
 *
 * 3. New indexes on the recreated `finances` table for the query
 *    patterns `src/db/queries/financesQueries.ts` exposes: listing by
 *    date (keyset pagination) and filtering by category. Also an index
 *    on `categories.type` for the Expenses/Incomes tabs' "categories of
 *    this type" query.
 */
export const migration002Statements: string[] = [
  // 1. categories.type
  `ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';`,
  `CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);`,

  // 2. drop finances.idType + the types table (table-recreate pattern).
  //    Foreign keys have to be OFF for the drop-and-rename below; the
  //    toggle used to live here as two statements, but the pragma is a
  //    no-op inside a transaction and this list now runs inside one, so
  //    `createTables` performs it around the transaction instead — see
  //    `requiresForeignKeysOff` in `src/db/db.ts`.
  `CREATE TABLE finances_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finance INTEGER NOT NULL,
    dateCreated TEXT NOT NULL,
    idCategory INTEGER NOT NULL,
    FOREIGN KEY (idCategory) REFERENCES categories(id)
  );`,
  `INSERT INTO finances_v2 (id, finance, dateCreated, idCategory)
    SELECT id, finance, dateCreated, idCategory FROM finances;`,
  `DROP TABLE finances;`,
  `ALTER TABLE finances_v2 RENAME TO finances;`,
  `DROP TABLE IF EXISTS types;`,

  // 3. finances indexes for the query patterns financesQueries.ts exposes
  `CREATE INDEX IF NOT EXISTS idx_finances_date_id ON finances(dateCreated DESC, id DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_finances_idCategory ON finances(idCategory);`,
];
