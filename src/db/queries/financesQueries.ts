import {SQLiteDatabase} from 'react-native-sqlite-storage';
import {isFiniteInteger} from './numberGuards';
import {AccountKind} from './accountsQueries';

/**
 * Minimal account identity, resolved via JOIN for every finance row —
 * screens need name/icon/kind alongside the amount without a second
 * round trip. NOT the same shape as `IAccountWithBalance`: a finance row
 * has no reason to carry every OTHER row's derived balance along with it.
 */
export interface IFinanceAccountRef {
  id: number;
  name: string;
  icon: string;
  kind: AccountKind;
}

/**
 * A single transaction/movement row, with its account and (if any)
 * category resolved via JOIN.
 *
 * - `amount`: SIGNED integer, smallest currency unit (cents) — negative
 *   = money left `account`, positive = money entered it. Never a float —
 *   see `src/db/creation/createFinancesTable.ts` for why integers, and
 *   `src/db/migrations/004_accountsAndSignedFinances.ts` for why signed.
 *   Callers doing display formatting are responsible for dividing by 100
 *   and applying locale/currency formatting; this layer only
 *   stores/returns integers.
 * - `dateCreated`: ISO-8601 string (e.g. `2026-08-29T12:00:00.000Z`),
 *   always UTC (`toISOString()`), so it both sorts correctly as plain
 *   text and compares consistently for keyset pagination.
 * - `account`: the account this movement belongs to. Every row has
 *   exactly one — `finances.idAccount` is `NOT NULL`.
 * - `category`: `null` for a transfer leg (a transfer's two rows move
 *   money between two accounts and are not "an expense" or "an income"
 *   in the categorized sense — see `src/db/queries/transfersQueries.ts`),
 *   otherwise the category this transaction is filed under, INCLUDING
 *   its `type`. IMPORTANT for any future income/expense aggregate: a
 *   transfer leg's `category` is `null`, `idCategory` is `NULL` at the
 *   column level — a `SUM(amount)`-style report that answers "how much
 *   did the user spend/earn" must filter `WHERE idCategory IS NOT NULL`
 *   (or `INNER JOIN categories`), never sum every `finances` row
 *   unconditionally, or a transfer's two legs would be miscounted as a
 *   fake expense + a fake income instead of the net-zero, non-categorized
 *   movement they actually are. This does NOT apply to per-account
 *   balance aggregates (`getAccounts`/`getNetWorth` in
 *   `accountsQueries.ts`): those correctly DO sum every row regardless of
 *   category, because a transfer genuinely does move money between two
 *   accounts' balances even though it is neither income nor expense.
 * - `transferGroupId`: `null` for a normal categorized row; for a
 *   transfer's two rows (see `insertTransfer` in
 *   `src/db/queries/transfersQueries.ts`), both rows share this same
 *   value, which is what lets them be found, displayed together, and
 *   deleted together (`deleteTransfer`).
 * - `transferCounterpartAccount`: `null` for a normal categorized row
 *   (`transferGroupId` is also `null`). For a transfer leg, the OTHER
 *   leg's account — e.g. for the outgoing leg at "Efectivo" of a
 *   transfer into "Juan" (a `receivable` account), this is `{name:
 *   "Juan", ...}`, letting the FE render "Transferencia a Juan" instead
 *   of a bare "Transferencia". Resolved via a self-join on
 *   `transferGroupId` in `getFinances` (backed by
 *   `idx_finances_transferGroupId`) rather than requiring a second
 *   round-trip per row — see that function for the query and the
 *   "exactly 2 legs per group" invariant this join relies on.
 */
export interface IFinanceRow {
  id: number;
  amount: number;
  dateCreated: string;
  account: IFinanceAccountRef;
  category: ICategory | null;
  transferGroupId: string | null;
  transferCounterpartAccount: IFinanceAccountRef | null;
}

export interface IInsertFinanceInput {
  /**
   * MAGNITUDE in cents — always a positive integer. The sign actually
   * persisted is derived from `idCategory`'s `type` (`expense` →
   * negative, `income` → positive), which is what makes
   * `initialBalance + SUM(amount)` a correct derived account balance.
   * Passing an already-signed value here would double-apply the sign;
   * this function always treats it as unsigned.
   */
  amount: number;
  /** The account this movement is posted against. Must already exist —
   * enforced by `finances.idAccount`'s `FOREIGN KEY`. */
  idAccount: number;
  /**
   * Optional at the TYPE level only because the `idCategory` COLUMN is
   * nullable (a transfer leg has no category — see
   * `src/db/migrations/004_accountsAndSignedFinances.ts`). This
   * FUNCTION still requires it: resolving `amount`'s sign needs a
   * category `type`, and there is no other channel here for a caller to
   * say "this is a transfer leg, use this explicit sign instead".
   * Omitting it throws. A transfer leg (categoryless, explicitly signed)
   * is written by `insertTransfer` in
   * `src/db/queries/transfersQueries.ts`, NOT by this function — do not
   * call `insertFinance` to record a transfer.
   */
  idCategory?: number;
  /**
   * ISO-8601 timestamp. Optional — defaults to `new Date().toISOString()`
   * (now, UTC) if omitted, which covers the common "log it now" case.
   */
  dateCreated?: string;
  /**
   * Pairs a transfer's two legs. This function never sets it on its own
   * initiative (every caller of `insertFinance` is writing a normal
   * categorized row); accepted here mainly so the column list/params
   * stay in one place. `insertTransfer` does NOT call this function —
   * it writes both legs itself inside one real SQLite transaction (see
   * `src/db/queries/transfersQueries.ts` for why `insertFinance`'s
   * plain autocommit `db.executeSql` is not atomicity-safe for a
   * two-row write).
   */
  transferGroupId?: string;
}

/** Keyset cursor: the last row's `(dateCreated, id)` from the previous page. */
export interface IFinancesCursor {
  dateCreated: string;
  id: number;
}

export interface IGetFinancesOptions {
  /** Defaults to 20. */
  limit?: number;
  /** Opaque cursor from the previous page's `nextCursor`; omit for page 1. */
  cursor?: IFinancesCursor;
  /** Filter to a single category (e.g. per-category history screen). */
  idCategory?: number;
  /** Filter to a single account (e.g. per-account transaction history —
   * backed by `idx_finances_idAccount_date_id` for the keyset predicate). */
  idAccount?: number;
}

export interface IGetFinancesResult {
  items: IFinanceRow[];
  /** Pass back into `getFinances({cursor})` for the next page; `null` at the end. */
  nextCursor: IFinancesCursor | null;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Inserts one movement row.
 *
 * Throws:
 * - `Error('amount must be a positive integer number of cents')` if
 *   `amount` is not a safe, positive integer (guards against passing a
 *   float dollar amount, a zero, or an already-signed value by mistake).
 * - `Error('insertFinance requires idCategory ...')` if `idCategory` is
 *   omitted (see `IInsertFinanceInput.idCategory`).
 * - `Error('Category <id> does not exist')` if `idCategory` does not
 *   resolve to a row in `categories` — checked explicitly with a SELECT
 *   BEFORE the insert, because the sign has to be resolved from the
 *   category's `type` before the `INSERT` can even be built; the FK
 *   alone (which would also reject this) only fires afterwards, with a
 *   less specific error.
 * - Whatever `db.executeSql` rejects with, unmodified, if the insert
 *   itself fails — in particular a `FOREIGN KEY constraint failed`
 *   error if `idAccount` does not exist in `accounts` (enforced now that
 *   `PRAGMA foreign_keys = ON` is set per connection; see `src/db/db.ts`).
 *
 * Returns the new row's `id` (from `insertId`), not the full row —
 * callers that need the full row (with account/category resolved)
 * should re-fetch via `getFinances`.
 */
export const insertFinance = async (
  db: SQLiteDatabase,
  {amount, dateCreated, idCategory, idAccount, transferGroupId}: IInsertFinanceInput,
): Promise<{id: number}> => {
  if (!isFiniteInteger(amount) || amount <= 0) {
    throw new Error('amount must be a positive integer number of cents');
  }
  if (idCategory === undefined) {
    throw new Error(
      'insertFinance requires idCategory to resolve the stored sign; ' +
        'categoryless transfer legs are not supported by this function yet (slice B3)',
    );
  }

  const [categoryResult] = await db.executeSql(
    'SELECT type FROM categories WHERE id = ?',
    [idCategory],
  );
  if (categoryResult.rows.length === 0) {
    throw new Error(`Category ${idCategory} does not exist`);
  }
  const categoryType = categoryResult.rows.item(0).type as ICategory['type'];
  const signedAmount = categoryType === 'income' ? amount : -amount;

  const resolvedDateCreated = dateCreated ?? new Date().toISOString();
  const insertQuery = `
    INSERT INTO finances (amount, dateCreated, idAccount, idCategory, transferGroupId)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await db.executeSql(insertQuery, [
    signedAmount,
    resolvedDateCreated,
    idAccount,
    idCategory,
    transferGroupId ?? null,
  ]);
  return {id: result.insertId};
};

/**
 * Lists movements newest-first, account and category resolved via JOIN,
 * using **keyset pagination** (`WHERE (dateCreated, id) < (cursor)`
 * instead of `OFFSET`) — the transaction list is expected to keep
 * growing for the lifetime of the app, and `OFFSET` degrades linearly
 * with page depth because SQLite still has to walk and discard every
 * skipped row.
 *
 * Ordered by `dateCreated DESC, id DESC` (id as tiebreaker for rows with
 * an identical timestamp). Backed by `idx_finances_date_id` normally, or
 * `idx_finances_idAccount_date_id` when `idAccount` is passed (both
 * indexes share the same trailing sort columns, so the keyset predicate
 * and the `ORDER BY` are covered either way). When `idCategory` is
 * passed, `idx_finances_idCategory` backs that filter.
 *
 * Never returns more than `limit` (default 20) rows regardless of table
 * size — always bounded, never a full scan.
 *
 * `transferCounterpartAccount` (see `IFinanceRow`) is resolved with a
 * SELF-JOIN back onto `finances` on `transferGroupId`, in this same
 * query — NOT a second round-trip per row, which would be an N+1 query
 * for any list of transactions containing transfers. The join:
 * ```
 * LEFT JOIN finances counterpart
 *   ON counterpart.transferGroupId = finances.transferGroupId
 *   AND counterpart.id <> finances.id
 * ```
 * relies on two facts that make it correct and cheap:
 * - For a non-transfer row, `finances.transferGroupId IS NULL`, and
 *   SQL's `NULL = NULL` is never true, so the join condition can never
 *   match — `transferCounterpartAccount` comes back `null` for those
 *   rows with no extra guard needed.
 * - For a transfer row, the join is backed by the partial index
 *   `idx_finances_transferGroupId (transferGroupId) WHERE
 *   transferGroupId IS NOT NULL` (see migration 4) — cheap, and it never
 *   grows for the (today: 100%, and likely always the majority)
 *   non-transfer rows since they are excluded from that index.
 * - This join assumes the invariant `insertTransfer`/`deleteTransfer`
 *   (`src/db/queries/transfersQueries.ts`) maintain: EXACTLY two rows
 *   ever share a given non-null `transferGroupId`. If that invariant were
 *   ever violated (e.g. by a caller other than those two functions
 *   writing/deleting `finances` rows with a hand-rolled
 *   `transferGroupId`), this join would fan out and duplicate the
 *   affected row(s) in the result set.
 */
export const getFinances = async (
  db: SQLiteDatabase,
  opts: IGetFinancesOptions = {},
): Promise<IGetFinancesResult> => {
  const limit = opts.limit ?? DEFAULT_PAGE_SIZE;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.cursor) {
    conditions.push(
      '(finances.dateCreated < ? OR (finances.dateCreated = ? AND finances.id < ?))',
    );
    params.push(opts.cursor.dateCreated, opts.cursor.dateCreated, opts.cursor.id);
  }

  if (opts.idCategory !== undefined) {
    conditions.push('finances.idCategory = ?');
    params.push(opts.idCategory);
  }

  if (opts.idAccount !== undefined) {
    conditions.push('finances.idAccount = ?');
    params.push(opts.idAccount);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Fetch one extra row to know whether there is a next page, without a
  // separate COUNT(*) query.
  params.push(limit + 1);

  const selectQuery = `
    SELECT
      finances.id AS id,
      finances.amount AS amount,
      finances.dateCreated AS dateCreated,
      finances.transferGroupId AS transferGroupId,
      accounts.id AS accountId,
      accounts.name AS accountName,
      accounts.icon AS accountIcon,
      accounts.kind AS accountKind,
      categories.id AS categoryId,
      categories.category AS categoryName,
      categories.icon AS categoryIcon,
      categories.type AS categoryType,
      counterpartAccount.id AS counterpartAccountId,
      counterpartAccount.name AS counterpartAccountName,
      counterpartAccount.icon AS counterpartAccountIcon,
      counterpartAccount.kind AS counterpartAccountKind
    FROM finances
    JOIN accounts ON accounts.id = finances.idAccount
    LEFT JOIN categories ON categories.id = finances.idCategory
    LEFT JOIN finances counterpart
      ON counterpart.transferGroupId = finances.transferGroupId
      AND counterpart.id <> finances.id
    LEFT JOIN accounts counterpartAccount ON counterpartAccount.id = counterpart.idAccount
    ${whereClause}
    ORDER BY finances.dateCreated DESC, finances.id DESC
    LIMIT ?;
  `;

  const [resultSet] = await db.executeSql(selectQuery, params);

  const rows: IFinanceRow[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    const row = resultSet.rows.item(index);
    rows.push({
      id: row.id,
      amount: row.amount,
      dateCreated: row.dateCreated,
      transferGroupId: row.transferGroupId ?? null,
      account: {
        id: row.accountId,
        name: row.accountName,
        icon: row.accountIcon,
        kind: row.accountKind,
      },
      category:
        row.categoryId == null
          ? null
          : {
              id: row.categoryId,
              name: row.categoryName,
              icon: row.categoryIcon,
              type: row.categoryType,
            },
      transferCounterpartAccount:
        row.counterpartAccountId == null
          ? null
          : {
              id: row.counterpartAccountId,
              name: row.counterpartAccountName,
              icon: row.counterpartAccountIcon,
              kind: row.counterpartAccountKind,
            },
    });
  }

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor: IFinancesCursor | null =
    hasNextPage && last ? {dateCreated: last.dateCreated, id: last.id} : null;

  return {items, nextCursor};
};

/**
 * Un movimiento por id, con su cuenta, su categoria y su contraparte de
 * transferencia resueltas — misma forma que devuelve `getFinances`.
 *
 * Lo necesita el modo edicion: las listas trabajan con `TransactItem`,
 * una forma ya aplanada para pintar (icono, etiqueta, importe), que no
 * lleva `idCategory` ni `idAccount`. Al pulsar largo solo se conoce el
 * id, asi que la fila real se relee de aqui en vez de arrastrar el
 * `IFinanceRow` completo por toda la UI.
 */
export const getFinanceById = async (
  db: SQLiteDatabase,
  id: number,
): Promise<IFinanceRow | null> => {
  const [resultSet] = await db.executeSql(
    `SELECT
        finances.id AS id,
        finances.amount AS amount,
        finances.dateCreated AS dateCreated,
        finances.idCategory AS idCategory,
        finances.transferGroupId AS transferGroupId,
        accounts.id AS accountId,
        accounts.name AS accountName,
        accounts.icon AS accountIcon,
        accounts.kind AS accountKind,
        categories.id AS categoryId,
        categories.category AS categoryName,
        categories.icon AS categoryIcon,
        categories.type AS categoryType,
        counterpartAccount.id AS counterpartAccountId,
        counterpartAccount.name AS counterpartAccountName,
        counterpartAccount.icon AS counterpartAccountIcon,
        counterpartAccount.kind AS counterpartAccountKind
      FROM finances
      JOIN accounts ON accounts.id = finances.idAccount
      LEFT JOIN categories ON categories.id = finances.idCategory
      LEFT JOIN finances counterpart
        ON counterpart.transferGroupId = finances.transferGroupId
        AND counterpart.id <> finances.id
      LEFT JOIN accounts counterpartAccount ON counterpartAccount.id = counterpart.idAccount
      WHERE finances.id = ?;`,
    [id],
  );
  if (resultSet.rows.length === 0) {
    return null;
  }
  const row = resultSet.rows.item(0);
  return {
    id: row.id,
    amount: row.amount,
    dateCreated: row.dateCreated,
    transferGroupId: row.transferGroupId ?? null,
    account: {
      id: row.accountId,
      name: row.accountName,
      icon: row.accountIcon,
      kind: row.accountKind,
    },
    category:
      row.categoryId === null
        ? null
        : {
            id: row.categoryId,
            name: row.categoryName,
            icon: row.categoryIcon,
            type: row.categoryType,
          },
    transferCounterpartAccount:
      row.counterpartAccountId === null
        ? null
        : {
            id: row.counterpartAccountId,
            name: row.counterpartAccountName,
            icon: row.counterpartAccountIcon,
            kind: row.counterpartAccountKind,
          },
  };
};

export interface IUpdateFinanceInput {
  /** MAGNITUD en centavos, positiva. El signo se deriva del tipo de la
   * categoria, igual que en `insertFinance`. */
  amount: number;
  idCategory: number;
  idAccount: number;
}

/**
 * Edita un movimiento: importe, categoria y cuenta.
 *
 * El signo se RECALCULA a partir del tipo de la categoria, igual que al
 * insertar. Asi mover un movimiento de una categoria de gasto a una de
 * ingreso invierte su signo, que es lo que el usuario espera al
 * corregir "esto no era un gasto, era un ingreso"; y guardar la
 * magnitud en positivo desde la UI evita que el signo dependa de como
 * venga escrito el campo.
 *
 * RECHAZA las patas de una transferencia. Una transferencia son DOS
 * filas hermanas con el mismo `transferGroupId` y importes espejo;
 * editar una sola dejaria dinero apareciendo o desapareciendo de la
 * nada, y editar las dos desde aqui seria reimplementar
 * `insertTransfer` con otro nombre. Para cambiar una transferencia se
 * borra (que borra las dos patas) y se vuelve a crear.
 *
 * Lanza:
 * - `Error('Finance <id> does not exist')`.
 * - `Error('Cannot edit a transfer leg')`.
 * - `Error('amount must be a positive integer number of cents')`.
 * - `Error('Category <id> does not exist')`.
 */
export const updateFinance = async (
  db: SQLiteDatabase,
  id: number,
  {amount, idCategory, idAccount}: IUpdateFinanceInput,
): Promise<void> => {
  if (!isFiniteInteger(amount) || amount <= 0) {
    throw new Error('amount must be a positive integer number of cents');
  }

  const [existing] = await db.executeSql(
    'SELECT transferGroupId FROM finances WHERE id = ?',
    [id],
  );
  if (existing.rows.length === 0) {
    throw new Error(`Finance ${id} does not exist`);
  }
  if (existing.rows.item(0).transferGroupId !== null) {
    throw new Error('Cannot edit a transfer leg');
  }

  const [categoryResult] = await db.executeSql(
    'SELECT type FROM categories WHERE id = ?',
    [idCategory],
  );
  if (categoryResult.rows.length === 0) {
    throw new Error(`Category ${idCategory} does not exist`);
  }
  const categoryType = categoryResult.rows.item(0).type as ICategory['type'];
  const signedAmount = categoryType === 'income' ? amount : -amount;

  await db.executeSql(
    'UPDATE finances SET amount = ?, idCategory = ?, idAccount = ? WHERE id = ?',
    [signedAmount, idCategory, idAccount, id],
  );
};

/**
 * Borra un movimiento. Si es una pata de transferencia, borra AMBAS.
 *
 * Media transferencia no es un dato incompleto, es dinero inventado: la
 * cuenta de origen se quedaria descontada sin que nadie hubiera
 * recibido nada. Y como el saldo de una cuenta es derivado
 * (`initialBalance + SUM(amount)`, sin columna que corregir), esa
 * corrupcion no se detectaria nunca despues. Las dos patas se borran en
 * UNA transaccion por lo mismo: si la segunda fallara, la primera ya
 * confirmada dejaria exactamente el agujero que esto evita.
 *
 * `deleted` dice cuantas filas se fueron (2 en una transferencia, 1 en
 * un movimiento normal) para que la pantalla pueda avisar de que se
 * borro la transferencia completa y no solo lo que se pulso.
 */
export const deleteFinance = async (
  db: SQLiteDatabase,
  id: number,
): Promise<{deleted: number; wasTransfer: boolean}> => {
  const [existing] = await db.executeSql(
    'SELECT transferGroupId FROM finances WHERE id = ?',
    [id],
  );
  if (existing.rows.length === 0) {
    return {deleted: 0, wasTransfer: false};
  }

  const transferGroupId: string | null = existing.rows.item(0).transferGroupId;
  if (transferGroupId === null) {
    const [result] = await db.executeSql('DELETE FROM finances WHERE id = ?', [id]);
    return {deleted: result.rowsAffected, wasTransfer: false};
  }

  const [legs] = await db.executeSql(
    'SELECT COUNT(*) AS total FROM finances WHERE transferGroupId = ?',
    [transferGroupId],
  );
  const total = legs.rows.item(0).total as number;

  // El callback es SINCRONO a proposito — ver `insertTransfer`.
  await db.transaction(tx => {
    tx.executeSql('DELETE FROM finances WHERE transferGroupId = ?', [transferGroupId]);
  });
  return {deleted: total, wasTransfer: true};
};
