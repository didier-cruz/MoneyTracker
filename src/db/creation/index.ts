import { createCategoriesTable } from './createCategoriesTable';
import { createFinancesTable } from './createFinancesTable';
import { createIconsTable } from './createIconsTable';
import { createTypesTable } from './createTypesTable';

/**
 * All `CREATE TABLE` statements, in FK-safe order (a table referenced by
 * a FOREIGN KEY is created before the table that references it:
 * `finances` references both `categories` and `types`).
 *
 * IMPORTANT: keep these as separate array entries and execute each one
 * with its own `executeSql` call (see `createTables` in `src/db/db.ts`).
 * Previously this module did
 * `[create...].join('\n')` and the caller ran the joined string through
 * a single `executeSql`. SQLite's driver only compiles the FIRST
 * statement passed to `executeSql` — every statement after the first
 * newline was silently ignored, so `finances`, `icons`, and `types` were
 * NEVER created in any shipped build; only `categories` existed. Do not
 * reintroduce that pattern.
 */
export const DbTables: string[] = [
  createCategoriesTable,
  createIconsTable,
  createTypesTable,
  createFinancesTable,
];

export {
  createCategoriesTable,
  createFinancesTable,
  createIconsTable,
  createTypesTable,
};
