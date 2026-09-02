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

/**
 * Una categoria por id, o `null` si no existe. Alimenta el modo edicion
 * del formulario, que necesita precargar nombre, icono y tipo.
 */
export const getCategoryById = async (
  db: SQLiteDatabase,
  id: number,
): Promise<ICategory | null> => {
  const [resultSet] = await db.executeSql(
    'SELECT id, category AS name, icon, type FROM categories WHERE id = ?',
    [id],
  );
  return resultSet.rows.length === 0 ? null : resultSet.rows.item(0);
};

/**
 * Cuantas filas dependen de una categoria. La pantalla lo usa para
 * avisar con numeros reales antes de borrar, en vez de con un "puede que
 * afecte a algo".
 */
export const getCategoryUsage = async (
  db: SQLiteDatabase,
  id: number,
): Promise<{movements: number; budgets: number}> => {
  const [finances] = await db.executeSql(
    'SELECT COUNT(*) AS total FROM finances WHERE idCategory = ?',
    [id],
  );
  const [budgets] = await db.executeSql(
    'SELECT COUNT(*) AS total FROM category_budgets WHERE idCategory = ?',
    [id],
  );
  return {
    movements: finances.rows.item(0).total,
    budgets: budgets.rows.item(0).total,
  };
};

/**
 * Renombra una categoria y/o le cambia el icono o el tipo.
 *
 * CAMBIAR EL TIPO esta prohibido si la categoria ya tiene movimientos, y
 * no por prudencia: el signo de un movimiento se guarda en la propia
 * fila (`finances.amount`, negativo para gasto desde la migracion 4), no
 * se deduce del tipo de su categoria. Cambiar el tipo no reescribe esos
 * signos, asi que un gasto de -123 pasaria a aparecer bajo Ingresos
 * SIENDO negativo: la pestana diria "ingreso" y la cifra diria lo
 * contrario. Reescribir los signos tampoco es la salida —falsearia el
 * historial— asi que la operacion se rechaza y la pantalla propone crear
 * otra categoria.
 *
 * Lanza:
 * - `Error('Invalid category type: ...')` con un tipo fuera de
 *   `CATEGORY_TYPES`.
 * - `Error('Cannot change the type of a category with movements')` en el
 *   caso de arriba.
 */
export const updateCategory = async (
  db: SQLiteDatabase,
  id: number,
  {name, icon, type}: {name: string; icon: string; type: ICategory['type']},
): Promise<void> => {
  if (!isValidCategoryType(type)) {
    throw new Error(`Invalid category type: ${type}`);
  }

  const [current] = await db.executeSql(
    'SELECT type FROM categories WHERE id = ?',
    [id],
  );
  if (current.rows.length === 0) {
    throw new Error(`Category ${id} does not exist`);
  }
  if (current.rows.item(0).type !== type) {
    const {movements} = await getCategoryUsage(db, id);
    if (movements > 0) {
      throw new Error('Cannot change the type of a category with movements');
    }
  }

  await db.executeSql(
    'UPDATE categories SET category = ?, icon = ?, type = ? WHERE id = ?',
    [name, icon, type, id],
  );
};

/**
 * Borra una categoria y desengancha lo que dependia de ella.
 *
 * Tres escrituras que van SI O SI juntas, en una transaccion:
 * 1. `finances.idCategory = NULL` en sus movimientos. NO se borran: el
 *    dinero se movio de verdad y el historial y los saldos tienen que
 *    seguir cuadrando. La columna es nullable desde la migracion 4
 *    —precisamente para las transferencias, que no tienen categoria— asi
 *    que esto no fuerza nada en el esquema. `mapFinanceRowToTransactItem`
 *    pinta esos movimientos como "Sin categoria".
 * 2. Borra sus limites mensuales. Un limite sin categoria no significa
 *    nada y su `idCategory` es NOT NULL, asi que no hay opcion de
 *    desenganchar: o se borra o bloquea el borrado de la categoria.
 * 3. Borra la categoria.
 *
 * Fuera de una transaccion, una interrupcion entre la 1 y la 3 dejaria
 * movimientos huerfanos de una categoria que sigue existiendo, o —peor—
 * un `DELETE` de la categoria rechazado por la clave ajena tras haber
 * borrado ya sus limites. El callback es SINCRONO a proposito, por el
 * motivo que documenta `insertTransfer`.
 *
 * Devuelve `false` si la categoria ya no existia. No lanza en ese caso:
 * es el estado que se buscaba.
 */
export const deleteCategory = async (
  db: SQLiteDatabase,
  id: number,
): Promise<boolean> => {
  const [existing] = await db.executeSql(
    'SELECT 1 FROM categories WHERE id = ?',
    [id],
  );
  if (existing.rows.length === 0) {
    return false;
  }

  await db.transaction(tx => {
    tx.executeSql('UPDATE finances SET idCategory = NULL WHERE idCategory = ?', [id]);
    tx.executeSql('DELETE FROM category_budgets WHERE idCategory = ?', [id]);
    tx.executeSql('DELETE FROM categories WHERE id = ?', [id]);
  });
  return true;
};
