/**
 * Migration `user_version` 3.
 *
 * Ships two independent, unrelated changes bundled into one version
 * bump because both are pure forward cleanup with no schema shape
 * change that would justify separate version numbers:
 *
 * 1. Seeds the 11 default categories every install needs. Today a
 *    fresh install boots with zero rows in `categories`, and the app
 *    has no way to record a transaction without one — the first run is
 *    a dead end. The 11 seed rows below (6 expense, 5 income) fix that.
 *
 * 2. Drops the dead `icons` table (see the dedicated write-up below).
 *
 * --- Why the seed VALUES are written out literally here, instead of
 * importing `categoriesData` from `src/data/categories.ts` ---
 *
 * `src/data/categories.ts` already holds the same 11 categories,
 * typed as `ICategory[]`, unused by any screen. It is tempting to
 * `import {categoriesData} from '@data/categories'` here and loop over
 * it to build the INSERT statements. That is deliberately NOT done:
 *
 * - A migration's job is to describe one fixed, historical transition
 *   between two schema versions. Its correctness must never depend on
 *   anything that can change after the migration ships — that is
 *   exactly what `PRAGMA user_version` gating exists to freeze. If this
 *   migration imported `categoriesData` and a later slice edited that
 *   array (renamed "House" to "Home", re-ordered the icon for
 *   "Interests", added a 12th category for an unrelated UI picker,
 *   etc.), this file's behavior would silently change retroactively
 *   for every *new* install running it for the first time after that
 *   edit — while every install that already ran version 3 keeps
 *   whatever the array looked like at the time it ran. Two installs on
 *   the same `user_version = 3` would then disagree on what their
 *   default categories are, with no record of why. That is the same
 *   class of bug this migration file already documents for editing an
 *   already-shipped migration's `statements` — the trigger is
 *   different (a mutable import vs. a hand-edit) but the failure mode
 *   (schema-versioned state silently diverging across installs) is
 *   identical.
 * - `src/data/categories.ts` is application-layer seed *material*: a
 *   convenient place for product/FE to look up "what are the 11
 *   defaults" without reading a migration file, or to reuse later for
 *   an in-app "restore default categories" action. It was never wired
 *   into anything, so nothing else depends on its exact contents
 *   today, but that is exactly why it must not be the migration's
 *   runtime source of truth: a file nothing imports can be edited by
 *   habit ("it's just data, nobody uses it") without anyone realizing
 *   it would also rewrite what new installs seed.
 * - Practically: it was ALSO unused after this decision (its only
 *   plausible reason for existing was as this migration's source), so
 *   it has been deleted rather than left as inert, drifting-from-truth
 *   duplicate data. The 11 rows below are now the single source of
 *   truth for the default category set; a future change to the
 *   defaults belongs in a NEW migration (e.g. an `UPDATE` in version 4
 *   for existing rows, plus updated literals in any future re-seed),
 *   never a hand-edit here.
 *
 * --- Idempotency & not touching user data ---
 *
 * `PRAGMA user_version` already guarantees this migration's statements
 * run exactly once per install (the same mechanism every migration in
 * this project relies on) — no parallel "have we seeded?" flag is
 * introduced.
 *
 * The remaining risk `user_version` alone does NOT cover: an install
 * that reaches version 3 already having its OWN categories. That is
 * possible today — `CreateCategory` (`insertCategory`, wired since
 * before this slice) is a working write path, so a sufficiently
 * determined user could already have created one or more categories
 * by hand before ever seeing this seed ship. If this migration
 * unconditionally inserted the 11 defaults, a user in that situation
 * would end up with the defaults ADDED ALONGSIDE whatever they already
 * made — not overwritten, but silently duplicated in a list they did
 * not ask for.
 *
 * The guard used: seed ONLY if `categories` has zero rows at the time
 * this migration starts. Given the history above (no seed has EVER
 * shipped before this migration; `categories` starts every install
 * completely empty and the only way a row can exist in it is a user
 * manually creating one), "table is empty" and "no user data exists
 * yet" are the same condition for every install this migration will
 * ever run against. A per-row name/type uniqueness check was
 * considered and rejected: `categories` has no unique constraint on
 * `(category, type)` (nothing in this codebase has ever needed one),
 * so "does a category named X of type Y already exist" is a fuzzier,
 * collation-sensitive check than "is the table empty", for a
 * distinction that does not exist in practice.
 *
 * Implementation note: the 11 `INSERT` statements below are separate
 * `executeSql` calls (required — see `src/db/creation/index.ts` for why
 * a driver only compiles the first statement of a multi-statement
 * string), so the "is the table empty" check CANNOT be a plain
 * `WHERE NOT EXISTS (SELECT 1 FROM categories)` re-evaluated by each
 * statement in turn — after the first INSERT commits, the table is no
 * longer empty, and every check after that would (correctly, but
 * unhelpfully) block itself, seeding only the first row. Instead, the
 * row count is snapshotted ONCE into a temp table before any INSERT
 * runs, and every INSERT's guard reads that frozen snapshot instead of
 * `categories` itself. The temp table is session-local and dropped at
 * the end of this migration; it never becomes part of the persisted
 * schema and does not need a `DROP` in any future migration.
 *
 * --- Why the seed rows have no explicit `id` ---
 *
 * `categoriesData` (now deleted, see above) used mock `id` values that
 * are NOT usable as real primary keys here: it numbered expense and
 * income categories independently (expense ids 1-6, income ids 1-5),
 * so "Loan" (income, mock id 3) and "Bills" (expense, mock id 3)
 * collide on `categories.id`, which is one AUTOINCREMENT sequence
 * shared across every row regardless of `type`. Inserting both with
 * their mock ids would violate the PRIMARY KEY. There is also no
 * product requirement anywhere in this codebase for default categories
 * to have specific, predictable ids: `finances.idCategory` is resolved
 * at write time by looking up whichever row `getCategories`/
 * `getCategoriesByType` returns (see `src/hooks/useFormScreen.ts`,
 * `src/hooks/useCategoryForm.ts`) — nothing hardcodes an expected id.
 * The `INSERT`s below therefore omit `id` entirely and let
 * `AUTOINCREMENT` assign it, exactly like every other `insertCategory`
 * call in the app.
 */
export const migration003Statements: string[] = [
  // Snapshot the pre-seed row count once, before any INSERT below can
  // change it. TEMP tables are connection/session-local — never part of
  // the on-disk schema, so no future migration needs to know about or
  // drop this.
  `CREATE TEMP TABLE _seed_guard AS SELECT COUNT(*) AS cnt FROM categories;`,

  // Expense defaults
  `INSERT INTO categories (category, icon, type)
    SELECT 'House', 'home', 'expense'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Food', 'shopping-cart', 'expense'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Bills', 'tags', 'expense'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Loan', 'university', 'expense'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Credit card', 'credit-card-alt', 'expense'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Children', 'child', 'expense'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,

  // Income defaults
  `INSERT INTO categories (category, icon, type)
    SELECT 'Salary', 'money', 'income'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Interests', 'line-chart', 'income'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Loan', 'university', 'income'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Credit card', 'credit-card-alt', 'income'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,
  `INSERT INTO categories (category, icon, type)
    SELECT 'Rent', 'home', 'income'
    WHERE (SELECT cnt FROM _seed_guard) = 0;`,

  `DROP TABLE _seed_guard;`,

  // --- Dead `icons` table cleanup ---
  //
  // `icons` was created in migration 1 (`src/db/creation/createIconsTable.ts`,
  // still referenced there and left untouched — migration 1's statements
  // are already shipped and must not be edited, see
  // `src/db/migrations/002_categoryTypeAndFinanceCleanup.ts` for the same
  // rule applied to `types`) but never seeded and never queried by any
  // screen: `SymbolList` and `CategoriesList` both read the 16 icon
  // choices straight from `src/data/icons.ts` (`import {icons} from
  // '@data/icons'`), not from the database. `src/db/queries/iconsQueries.ts`
  // (`insertIcon`/`getIcons`) has zero call sites outside itself and the
  // query barrel re-export — the exact same "orphaned lookup table + CRUD
  // that nothing calls" shape `types` had before migration 2 removed it.
  // `icons` is dropped here for the same reason, and `iconsQueries.ts` is
  // deleted alongside this migration (see `src/db/queries/index.ts`).
  //
  // Note: `src/data/icons.ts` (the static list the UI actually reads) is
  // NOT touched by this decision — it is live, imported code, unrelated
  // to this dead database table beyond sharing a name.
  `DROP TABLE IF EXISTS icons;`,
];
