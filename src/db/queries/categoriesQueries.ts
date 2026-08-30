import {SQLiteDatabase} from 'react-native-sqlite-storage';

/**
 * `categories` columns are `id` / `category` / `icon` / `type` (the
 * `type` column was added in migration `user_version` 2 — see
 * `src/db/migrations/002_categoryTypeAndFinanceCleanup.ts`). The name
 * column is `category`, not `name`, so it does not structurally match
 * the global `ICategory` interface (`{id, icon, name, type}`) declared
 * in `src/interfaces/common.d.ts` as-is.
 *
 * Rather than leaving that mismatch for every call site to work around
 * (as the previous slice's `ICategoryRow` did), the SELECT below aliases
 * `category AS name` so the row shape returned to callers IS `ICategory`
 * — no separate row type, no mapping step at the call site. This is the
 * final contract: `getCategories` returns `ICategory[]` directly.
 */
export const CATEGORY_TYPES = ['income', 'expense'] as const;

const isValidCategoryType = (type: string): type is ICategory['type'] =>
  (CATEGORY_TYPES as readonly string[]).includes(type);

export const insertCategory = async (
  db: SQLiteDatabase,
  category: string,
  icon: string,
  type: ICategory['type'],
) => {
  if (!isValidCategoryType(type)) {
    // Defense in depth: the DB column has no CHECK constraint (see the
    // migration file for why), so this is the only thing rejecting an
    // invalid value before it reaches storage.
    throw new Error(`Invalid category type: ${type}`);
  }
  const insertQuery =
    'INSERT INTO categories (category, icon, type) VALUES (?, ?, ?)';
  return db.executeSql(insertQuery, [category, icon, type]);
};

export const getCategories = async (
  db: SQLiteDatabase,
): Promise<ICategory[]> => {
  const categories: ICategory[] = [];
  const [resultSet] = await db.executeSql(
    'SELECT id, category AS name, icon, type FROM categories',
  );

  for (let index = 0; index < resultSet.rows.length; index++) {
    categories.push(resultSet.rows.item(index));
  }
  return categories;
};

/**
 * Same as `getCategories` filtered to a single type. Backs the
 * Expenses/Incomes tabs, which each only ever need one type's
 * categories — uses the `idx_categories_type` index added alongside
 * `categories.type` in migration 2.
 */
export const getCategoriesByType = async (
  db: SQLiteDatabase,
  type: ICategory['type'],
): Promise<ICategory[]> => {
  const categories: ICategory[] = [];
  const [resultSet] = await db.executeSql(
    'SELECT id, category AS name, icon, type FROM categories WHERE type = ?',
    [type],
  );

  for (let index = 0; index < resultSet.rows.length; index++) {
    categories.push(resultSet.rows.item(index));
  }
  return categories;
};
