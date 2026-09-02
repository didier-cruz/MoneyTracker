import {enablePromise, openDatabase, SQLiteDatabase} from 'react-native-sqlite-storage';
import {DbTables} from './creation';
import {migration002Statements} from './migrations/002_categoryTypeAndFinanceCleanup';
import {migration003Statements} from './migrations/003_seedDefaultCategories';
import {migration004Statements} from './migrations/004_accountsAndSignedFinances';
import {migration005Statements} from './migrations/005_envelopesAndCategoryBudgets';
import {migration006Statements} from './migrations/006_loanAccountKindAndInterestCategory';

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
 * - Version 6 (`migration006Statements`, see
 *   `src/db/migrations/006_loanAccountKindAndInterestCategory.ts`):
 *   anade `'loan'` a los tipos de cuenta —reconstruyendo `accounts`,
 *   porque su `CHECK` no se puede alterar— y siembra una categoria de
 *   GASTO "Interests", que faltaba (la de la migracion 3 es de
 *   ingreso). Ambos para poder registrar un financiamiento separando
 *   amortizacion de capital y coste financiero.
 * - To ship a schema change later, ADD a new entry with an incremented
 *   `version` and the `CREATE`/`ALTER` statements needed to get from
 *   the previous version to this one. Never edit an already-shipped
 *   migration's `statements` — installs that already ran it will not
 *   re-run it, so editing it silently diverges old and new installs.
 */
type Migration = {
  version: number;
  statements: string[];
  /**
   * Set when the migration recreates an existing table with the
   * drop-and-rename dance (versions 2 and 4), which needs foreign key
   * enforcement OFF for the duration.
   *
   * It is a flag rather than two `PRAGMA foreign_keys` statements in
   * `statements` — where it used to live — because `createTables` now
   * runs every migration inside a transaction, and SQLite IGNORES that
   * pragma inside one. Left in the list it would have silently done
   * nothing and the `DROP TABLE finances` would have failed (or, worse,
   * cascaded). `createTables` toggles it around the transaction, which
   * is the order SQLite's own "making other kinds of table schema
   * changes" recipe prescribes.
   */
  requiresForeignKeysOff?: boolean;
};

const migrations: Migration[] = [
  {version: 1, statements: DbTables},
  {
    version: 2,
    statements: migration002Statements,
    requiresForeignKeysOff: true,
  },
  {version: 3, statements: migration003Statements},
  {
    version: 4,
    statements: migration004Statements,
    requiresForeignKeysOff: true,
  },
  {version: 5, statements: migration005Statements},
  {
    version: 6,
    statements: migration006Statements,
    // Reconstruye `accounts`, a la que `finances.idAccount` apunta con
    // una clave ajena — ver la migracion para el detalle.
    requiresForeignKeysOff: true,
  },
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

/**
 * Applies ONE migration atomically: every statement plus the
 * `user_version` bump that records it, as a single transaction.
 *
 * Why this has to be transactional. Before this, each statement ran
 * autocommit and `user_version` was only bumped after the last one, so
 * an interruption mid-migration (the process killed, a constraint
 * violation, a device out of storage) left the database in a state that
 * matched NO version: half the work committed, the counter still on the
 * old value. The next launch re-ran the whole migration from the top
 * against that half-migrated database, and every one of them broke in
 * its own way:
 * - Version 2 and 4 re-ran `CREATE TABLE finances_v2` / `finances_v3`,
 *   which already existed: `table already exists`, thrown on every
 *   launch forever. The app could never boot again, and since this is
 *   the only copy of the user's financial history, the only way out was
 *   a reinstall — total data loss.
 * - Version 3's seed is guarded by a snapshot of whether categories
 *   already existed. On a retry that snapshot saw the categories the
 *   interrupted run had just inserted, concluded the install had its
 *   own, and skipped the rest: permanently and silently short of the 11
 *   default categories.
 * - Version 4 re-ran its default-account `INSERT`, leaving a duplicate
 *   'Efectivo' with no rows pointing at it.
 * Wrapped in a transaction, an interrupted migration rolls back whole.
 * The database is always on exactly one version, and a retry starts
 * from the same place the first attempt did.
 *
 * `PRAGMA user_version` is set INSIDE the transaction on purpose: it
 * lives in the database header and is written transactionally like any
 * other page, so committing it together with the statements it
 * describes is what makes "schema and version can never disagree" true
 * rather than merely likely.
 *
 * `db.transaction()` (not manual `BEGIN`/`COMMIT`) for the reason
 * `insertTransfer` documents at length in
 * `src/db/queries/transfersQueries.ts`: only the driver's own
 * transaction queues the whole scope as ONE entry on the shared
 * per-database queue, so no other caller on this singleton connection
 * can interleave a statement into the middle of it. The scope callback
 * must stay SYNCHRONOUS — the driver calls `run()` the moment it
 * returns, so anything queued after an `await` would land outside the
 * transaction. That is why this loops with plain `tx.executeSql` calls
 * and awaits nothing inside.
 */
const runMigration = async (
  db: SQLiteDatabase,
  migration: Migration,
): Promise<void> => {
  // Outside the transaction, and only for the migrations that need it:
  // SQLite silently ignores this pragma while a transaction is open.
  // Nothing else touches the database at this point — `initDatabase`
  // runs before the UI mounts — so the brief window where enforcement
  // is off is not observable by any other caller.
  if (migration.requiresForeignKeysOff) {
    await db.executeSql('PRAGMA foreign_keys = OFF;');
  }

  try {
    await db.transaction(tx => {
      for (const statement of migration.statements) {
        tx.executeSql(statement);
      }
      // PRAGMA statements don't support bound `?` parameters; `version`
      // is always an internal integer constant from `migrations` above,
      // never user input, so string interpolation here is safe.
      tx.executeSql(`PRAGMA user_version = ${migration.version};`);
    });
  } finally {
    // Restored even when the transaction rolls back: `getDbConnection`
    // turns foreign keys ON for the life of the connection, and leaving
    // them off would silently disable enforcement for every query the
    // app makes afterwards.
    if (migration.requiresForeignKeysOff) {
      await db.executeSql('PRAGMA foreign_keys = ON;');
    }
  }
};

/**
 * Creates/upgrades the schema by running every migration whose
 * `version` is greater than the database's current `user_version`, in
 * ascending order, one statement at a time (SQLite's driver only
 * compiles the first statement of a string passed to `executeSql`, so
 * each statement must be its own call — see `src/db/creation/index.ts`).
 *
 * Each migration is applied ATOMICALLY by `runMigration` below: all of
 * its statements and its `user_version` bump commit together or not at
 * all. Migrations are still applied one after another rather than all
 * in one transaction, so an install several versions behind that fails
 * on version 4 keeps the 2 and 3 it already completed.
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
      await runMigration(db, migration);
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
