/**
 * `finances` stores each transaction (income or expense).
 *
 * SQLite has no native MONEY/DATETIME column types. Unknown type names
 * like the previous `SMALLMONEY` / `SMALLDATETIME` (SQL Server types)
 * silently fall back to SQLite's NUMERIC column affinity via SQLite's
 * type-affinity rules (https://www.sqlite.org/datatype3.html#affinity) —
 * they "work" but don't mean what they look like they mean, and don't
 * document the real storage format. Chosen instead:
 *
 * - `finance INTEGER` — the amount stored in the smallest currency unit
 *   (e.g. cents) as a whole number. Storing money as REAL/float causes
 *   rounding errors; INTEGER minor-units is the standard safe choice and
 *   SQLite's native INTEGER affinity guarantees exact storage.
 * - `dateCreated TEXT` — an ISO-8601 timestamp string
 *   (e.g. `2026-08-29T12:00:00.000Z`). This is SQLite's own recommended
 *   date/time representation (https://www.sqlite.org/lang_datefunc.html):
 *   it sorts/compares correctly as plain text and is readable by
 *   SQLite's built-in date/time functions.
 *
 * NOTE ON MIGRATIONS: changing column types in a `CREATE TABLE IF NOT
 * EXISTS` does NOT retroactively fix an already-created table with the
 * old types — SQLite just no-ops the CREATE. That is not an issue here
 * because of the bug fixed in `src/db/creation/index.ts` (all
 * `CREATE TABLE` statements were being concatenated into one string and
 * executed as a single `executeSql` call, so SQLite only ever compiled
 * the first statement): `finances` was NEVER actually created in any
 * shipped build, so there is nothing to migrate away from. Going
 * forward, any further column-type change to an already-shipped table
 * DOES need an explicit migration — see the version-gated migration
 * list in `src/db/db.ts` (`PRAGMA user_version`).
 */
export const createFinancesTable = `
CREATE TABLE IF NOT EXISTS finances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finance INTEGER,
  dateCreated TEXT,
  idCategory INTEGER,
  idType INTEGER,
  FOREIGN KEY (idCategory) REFERENCES categories(id),
  FOREIGN KEY (idType) REFERENCES types(id)
);`;
