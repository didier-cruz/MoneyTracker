import {enablePromise, openDatabase, SQLiteDatabase} from 'react-native-sqlite-storage';
import {DbTables} from './creation';
import {migration002Statements} from './migrations/002_categoryTypeAndFinanceCleanup';
import {migration003Statements} from './migrations/003_seedDefaultCategories';
import {migration004Statements} from './migrations/004_accountsAndSignedFinances';
import {migration005Statements} from './migrations/005_envelopesAndCategoryBudgets';

enablePromise(true);

const DATABASE_NAME = 'moneytracker.db';

/**
 * Ordered, version-gated migration list, applied against SQLite's
 * built-in `PRAGMA user_version` counter (an integer stored in the
 * database file itself — no extra metadata table needed).
 *
 * - Version 1 is the initial schema (`DbTables`: categories, icons,
 *   types, finances).
 * - Version 2 (`migration002Statements`, see
 *   `src/db/migrations/002_categoryTypeAndFinanceCleanup.ts`): adds
 *   `categories.type`, drops `finances.idType`/`types` (redundant once
 *   the category itself carries its type), and adds the finances/
 *   categories indexes the query layer needs.
 * - Version 3 (`migration003Statements`, see
 *   `src/db/migrations/003_seedDefaultCategories.ts`): seeds the 11
 *   default categories, guarded so it never runs against an install
 *   that already has categories of its own, and drops the dead `icons`
 *   table (never seeded, never queried — same fate as `types` in
 *   version 2).
 * - Version 4 (`migration004Statements`, see
 *   `src/db/migrations/004_accountsAndSignedFinances.ts`): adds
 *   `accounts` (cash / bank / credit card / receivable), seeds one
 *   default account to reassign any pre-existing `finances` rows to,
 *   and recreates `finances` with a required `idAccount`, a SIGNED
 *   `amount` (derived from each existing row's category type during the
 *   backfill), and a nullable `idCategory`/`transferGroupId` (the latter
 *   reserved for slice B3's transfers).
 * - Version 5 (`migration005Statements`, see
 *   `src/db/migrations/005_envelopesAndCategoryBudgets.ts`): slice B5 —
 *   adds `envelopes` + `envelope_movements` (sobres: Fondos/Deudas, each
 *   with its own derived, `finances`-independent balance) and
 *   `category_budgets` (a monthly spending ceiling per category), plus
 *   one new index on the existing `finances` table for the category/
 *   period spend aggregate this slice reads. No existing table is
 *   recreated — every statement is a fresh `CREATE TABLE`/`CREATE INDEX`.
 * - To ship a schema change later, ADD a new entry with an incremented
 *   `version` and the `CREATE`/`ALTER` statements needed to get from
 *   the previous version to this one. Never edit an already-shipped
 *   migration's `statements` — installs that already ran it will not
 *   re-run it, so editing it silently diverges old and new installs.
 */
type Migration = {version: number; statements: string[]};

const migrations: Migration[] = [
  {version: 1, statements: DbTables},
  {version: 2, statements: migration002Statements},
  {version: 3, statements: migration003Statements},
  {version: 4, statements: migration004Statements},
  {version: 5, statements: migration005Statements},
];

const SCHEMA_VERSION = migrations[migrations.length - 1].version;

let dbInstance: SQLiteDatabase | null = null;

/**
 * Returns the single shared `SQLiteDatabase` connection for the app.
 *
 * react-native-sqlite-storage connections are not cheap to open, and
 * this library shares a native handle per database name — closing it
 * while another query is in flight can abort that query. We therefore
 * open the connection lazily, once, and keep it open for the lifetime
 * of the app process instead of opening/closing per call.
 *
 * `PRAGMA foreign_keys = ON` is set once here, immediately after the
 * connection is opened and before anything else runs against it. Two
 * things make this the only correct place for it:
 * - The pragma is a per-connection setting, not a database-file setting
 *   (unlike `user_version`): SQLite resets it to its default (OFF) on
 *   every new connection, so it has to be re-applied every time this
 *   singleton actually opens a handle — never assume it "stuck" from a
 *   previous run.
 * - It cannot be changed while inside a transaction, and `finances`'s
 *   `FOREIGN KEY (idCategory) REFERENCES categories(id)` (and, since
 *   version 4, `FOREIGN KEY (idAccount) REFERENCES accounts(id)`) only
 *   have any effect at all once this is set — before this fix SQLite
 *   parsed and stored the constraint but never enforced it, silently
 *   accepting `finances` rows pointing at nonexistent categories.
 *
 * Callers must NOT call `.close()` on the value returned here; use
 * `closeDbConnection` (app teardown / tests only) instead.
 */
export const getDbConnection = async (): Promise<SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }
  const db = await openDatabase({name: DATABASE_NAME, location: 'default'});
  await db.executeSql('PRAGMA foreign_keys = ON;');
  dbInstance = db;
  return dbInstance;
};

/**
 * Closes the shared connection and clears the cached instance so a
 * subsequent `getDbConnection` call reopens it. Only intended for app
 * teardown or tests — regular query code should never call this.
 */
export const closeDbConnection = async (): Promise<void> => {
  if (!dbInstance) {
    return;
  }
  const db = dbInstance;
  dbInstance = null;
  await db.close();
};

const getUserVersion = async (db: SQLiteDatabase): Promise<number> => {
  const [result] = await db.executeSql('PRAGMA user_version;');
  return result.rows.item(0).user_version as number;
};

const setUserVersion = async (db: SQLiteDatabase, version: number): Promise<void> => {
  // PRAGMA statements don't support bound `?` parameters; `version` is
  // always an internal integer constant from `migrations` above, never
  // user input, so string interpolation here is safe.
  await db.executeSql(`PRAGMA user_version = ${version};`);
};

/**
 * Creates/upgrades the schema by running every migration whose
 * `version` is greater than the database's current `user_version`, in
 * ascending order, one statement at a time (SQLite's driver only
 * compiles the first statement of a string passed to `executeSql`, so
 * each statement must be its own call — see `src/db/creation/index.ts`).
 *
 * Errors are logged AND re-thrown: previously this function swallowed
 * every error via `console.log` and returned `undefined`, which is how
 * the `finances`/`icons`/`types` tables silently failed to exist for
 * months. Callers (ultimately `initDatabase`) must be allowed to fail
 * loudly instead of continuing with a half-created schema.
 */
export const createTables = async (db: SQLiteDatabase): Promise<void> => {
  try {
    const currentVersion = await getUserVersion(db);

    const pending = migrations
      .filter(migration => migration.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      for (const statement of migration.statements) {
        await db.executeSql(statement);
      }
      await setUserVersion(db, migration.version);
    }
  } catch (error: any) {
    console.log('[db] createTables failed:', error?.message ?? error);
    throw error;
  }
};

/**
 * Opens (or reuses) the shared connection and ensures the schema is up
 * to date. Rejects if table creation fails — callers should handle/log
 * that rejection (e.g. surface it to the user or crash reporting)
 * rather than assuming the database is ready.
 */
export const initDatabase = async (): Promise<void> => {
  const db = await getDbConnection();
  await createTables(db);
};

export {SCHEMA_VERSION};
