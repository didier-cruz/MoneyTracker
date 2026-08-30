export * from './accountsQueries';
export * from './analyticsQueries';
export * from './budgetsQueries';
export * from './categoriesQueries';
export * from './envelopesQueries';
export * from './financesQueries';
export * from './period';
export * from './transfersQueries';

/**
 * `typesQueries.ts` (income/expense lookup table `types`) was removed in
 * migration `user_version` 2 — see
 * `src/db/migrations/002_categoryTypeAndFinanceCleanup.ts` for the
 * redundancy argument (categories now carry their own `type`). The
 * `types` table itself is dropped by that migration; there is nothing
 * left to query.
 *
 * `iconsQueries.ts` (`insertIcon`/`getIcons`, over the `icons` table)
 * was removed in migration `user_version` 3 — see
 * `src/db/migrations/003_seedDefaultCategories.ts`. `icons` was created
 * in migration 1 but never seeded and never queried by any screen
 * (`SymbolList`/`CategoriesList` read their icon choices from the
 * static `src/data/icons.ts`, not the database); the same orphaned
 * lookup table + unused CRUD shape `types` had before version 2. The
 * `icons` table itself is dropped by migration 3; there is nothing left
 * to query.
 */
