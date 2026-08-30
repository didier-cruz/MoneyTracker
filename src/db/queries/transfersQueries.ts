import {ResultSet, SQLiteDatabase, Transaction} from 'react-native-sqlite-storage';
import {isFiniteInteger} from './numberGuards';

/**
 * Slice B3 — transfers between two of the user's own accounts, and the
 * mechanism lending money is built on ("prestarle a Juan" = a transfer
 * INTO his `receivable` account; each repayment a transfer back OUT of
 * it — see `src/db/migrations/004_accountsAndSignedFinances.ts`).
 *
 * A transfer is modeled as exactly TWO rows in `finances` sharing one
 * `transferGroupId` (`finances.transferGroupId TEXT`, added — unused —
 * by migration 4 for exactly this): a negative-amount row at the source
 * account, a positive-amount row at the destination account, neither
 * with a category. Because `amount` is signed and the two rows sum to
 * zero, net worth does not move on its own — see `IFinanceRow.category`'s
 * doc in `financesQueries.ts` for why a future income/expense report must
 * still explicitly exclude categoryless rows, even though per-account
 * balance aggregates (which just `SUM(amount)`) need no special-casing at
 * all.
 */

/**
 * Generates a `transferGroupId` WITHOUT any UUID library (none is
 * installed; do not add one without asking first — see this slice's
 * task brief). Format: `tg_<ms-since-epoch base36>_<random base36>_
 * <in-process sequence base36>`, e.g. `tg_m5x2k1a0_f3q1z9_1`.
 *
 * Why this is enough uniqueness for THIS database, and not a general-
 * purpose UUID replacement:
 * - This id is never sent anywhere else, never compared across devices
 *   or installs, and never persisted outside this one SQLite file. Its
 *   ONLY job is to let two rows inserted by the SAME `insertTransfer`
 *   call be found together later (`WHERE transferGroupId = ?`) and to
 *   never collide with a DIFFERENT transfer's id in the SAME database.
 * - The app is local-first and single-user (no server, no multi-device
 *   sync of this table today), and transfers are a manual, human-paced
 *   action (a user tapping "transfer" at most a handful of times a
 *   minute) — not a high-frequency automated write path.
 * - `Date.now()` (millisecond resolution) alone would not be safe if two
 *   transfers could ever be created within the same millisecond (e.g. a
 *   future "repay in two installments" bulk action), so it is combined
 *   with:
 *   - `Math.random()`, which gives ~52 bits of entropy per call — on its
 *     own already collision-resistant enough for this volume; and
 *   - an in-process monotonically increasing sequence counter, which
 *     makes same-millisecond collisions from THIS running process
 *     provably impossible (not just statistically unlikely), independent
 *     of `Math.random()`'s quality.
 * - The sequence counter resets to 0 on every app restart, so it alone
 *   cannot prevent a collision ACROSS restarts — but `Date.now()` differs
 *   across restarts (the app cannot restart twice in the same
 *   millisecond), so the combination covers both the "many transfers, one
 *   process" and the "app restarted" cases.
 */
let transferSequence = 0;
export const generateTransferGroupId = (): string => {
  transferSequence = (transferSequence + 1) % 1_000_000;
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  const sequencePart = transferSequence.toString(36);
  return `tg_${timestampPart}_${randomPart}_${sequencePart}`;
};

export interface IInsertTransferInput {
  /** The account money leaves. Must exist and not be archived. */
  idAccountFrom: number;
  /** The account money enters. Must exist and not be archived. Must
   * differ from `idAccountFrom` — a transfer to the same account is not
   * a movement of any kind. */
  idAccountTo: number;
  /** MAGNITUDE in cents — always a positive integer, same convention as
   * `IInsertFinanceInput.amount`. The function derives both legs' signed
   * amounts itself (`-amount` at the source, `+amount` at the
   * destination); passing an already-signed value would double-apply the
   * sign on one leg. */
  amount: number;
  /** ISO-8601 timestamp shared by BOTH legs (a transfer happens at one
   * instant). Optional — defaults to `new Date().toISOString()` (now,
   * UTC) if omitted. */
  dateCreated?: string;
}

export interface IInsertTransferResult {
  /** Shared by both legs; pass to `deleteTransfer` to undo, or use to
   * find the counterpart leg (`getFinances`'s
   * `transferCounterpartAccount` already resolves this for display). */
  transferGroupId: string;
  /** `id` of the negative-amount row at `idAccountFrom`. */
  legOutId: number;
  /** `id` of the positive-amount row at `idAccountTo`. */
  legInId: number;
}

/**
 * Inserts a transfer: two rows in `finances`, one negative at
 * `idAccountFrom`, one positive at `idAccountTo`, sharing a freshly
 * generated `transferGroupId`, atomically — either both rows exist
 * afterwards or neither does.
 *
 * ## Atomicity mechanism — why `db.transaction()`, not manual `BEGIN`/
 * `COMMIT`, and not the plain autocommit `db.executeSql()` every other
 * function in this layer uses
 *
 * Every other query in this codebase calls `db.executeSql()` directly,
 * which runs each statement autocommit — each one commits on its own the
 * instant it succeeds. That is fine for a single-statement write
 * (`insertFinance`, `insertAccount`, ...), but wrong here: if the first
 * leg's `INSERT` commits and the second one then fails (a constraint
 * violation, the app being killed, anything), the source account is
 * permanently down that money with NO corresponding destination row —
 * and because this schema's account balance is DERIVED
 * (`initialBalance + SUM(finances.amount)`, never a stored, correctable
 * column — see migration 4), there is no later point where that
 * corruption could even be detected, let alone repaired. It just becomes
 * a wrong balance forever.
 *
 * `react-native-sqlite-storage` (this project's driver) exposes TWO ways
 * to get real atomicity, and this function deliberately picks the
 * second, not the first:
 *
 * 1. Manual `BEGIN`/`COMMIT` via separate `db.executeSql('BEGIN')`,
 *    `db.executeSql('INSERT ...')` × 2, `db.executeSql('COMMIT')` calls.
 *    REJECTED: every `db.executeSql()` call — transactional-looking SQL
 *    text or not — is, internally, its OWN independent unit pushed onto
 *    one shared per-database FIFO queue (`SQLitePlugin.prototype.
 *    executeSql` wraps it in its own `SQLitePluginTransaction` with
 *    `txlock: false`, and that queue is the SAME one `db.transaction()`
 *    itself uses — see `node_modules/react-native-sqlite-storage/lib/
 *    sqlite.core.js`, `addTransaction`/`startNextTransaction`). Each of
 *    those four autocommit calls FINISHES (and the queue advances to
 *    whatever is next) before the next one is even issued, because each
 *    is `await`ed in turn. Nothing stops some UNRELATED concurrent caller
 *    sharing this app's singleton connection (`getDbConnection` in
 *    `src/db/db.ts`) — e.g. a screen's `getAccounts()` polling
 *    balances — from having ITS OWN `executeSql` queued and run in
 *    between our `BEGIN` and our two `INSERT`s, reading a database that
 *    is, at the SQLite engine level, sitting inside our still-open,
 *    uncommitted transaction. Manual `BEGIN`/`COMMIT` gets none of this
 *    driver's queuing protection — only `db.transaction()` does (below).
 *
 * 2. `db.transaction(scope)` — THE ONE THIS FUNCTION USES. Internally,
 *    `SQLitePluginTransaction` (same file) queues the ENTIRE scope —
 *    its own `BEGIN`, every `tx.executeSql()` call made synchronously
 *    inside `scope`, and its own `COMMIT`/`ROLLBACK` — as ONE single
 *    queue entry. The shared queue only advances to the next entry once
 *    this whole unit finishes (commits) or aborts (rolls back). No other
 *    caller on the same connection — autocommit `executeSql` or another
 *    `transaction()` — can have any statement interleaved between this
 *    transfer's two legs. This is exactly the "singleton connection risk"
 *    the task asked about: the risk is real for option 1, and is what
 *    `db.transaction()` exists to close.
 *
 * ### The trap: the `scope` callback must be SYNCHRONOUS, not `async`
 *
 * `db.transaction()`'s `scope` is called as `this.fn(this); this.run();`
 * — `run()` (which sends every queued statement as one native batch and
 * then commits/rolls back based on the result) is invoked IMMEDIATELY
 * after `scope` returns, with NO `await` in between. If `scope` were
 * written as `async (tx) => { await tx.executeSql(legA); await
 * tx.executeSql(legB); }`, only the statements queued BEFORE the first
 * `await` yields would make it into that batch: `run()` would fire after
 * `legA` alone is queued, commit it alone, and mark the transaction
 * `finalized`. When the `async` function later resumed to queue `legB`,
 * it would hit `SQLitePluginTransaction.prototype.executeSql`'s own
 * `finalized` guard and throw "this transaction is already finalized" —
 * silently, into an unhandled rejection, AFTER leg A has already
 * committed alone. That is the exact silent-corruption failure mode this
 * whole function exists to prevent, self-inflicted by the wrong `scope`
 * shape. `insertTransfer` therefore passes a plain, non-`async` scope
 * that calls both `tx.executeSql(...)` synchronously, back to back, with
 * every value they need already computed beforehand — neither leg's
 * `INSERT` needs data read back from the other, so there is no reason
 * either statement would ever need to `await` something before the next
 * one is queued.
 *
 * ## Validation order (all before the transaction opens; the first three
 * never touch SQL at all)
 * 1. `amount` must be a positive integer (cents) —
 *    `Error('amount must be a positive integer number of cents')`.
 * 2. `idAccountFrom`/`idAccountTo` must be integers —
 *    `Error('idAccountFrom and idAccountTo must be integer account ids')`.
 * 3. They must differ — `Error('A transfer requires two different
 *    accounts: idAccountFrom must differ from idAccountTo')`.
 * 4. Both accounts must exist — `Error('Account <id> does not exist')` —
 *    and neither may be archived — `Error('Account <id> is archived and
 *    cannot be used in a transfer')` — checked with ONE `SELECT ... WHERE
 *    id IN (?, ?)` read (autocommit, outside the transaction — a plain
 *    read gains nothing from being inside the write transaction, and
 *    `db.transaction()`'s synchronous-scope constraint above means this
 *    lookup could not happen mid-scope anyway).
 *
 *    Known, accepted gap: there is a small window between this read and
 *    the transaction's `INSERT`s where, in principle, an account could be
 *    archived. This app is local-first and single-user with no
 *    concurrent-writer story (see `generateTransferGroupId`'s doc for the
 *    same reasoning) — the realistic risk is effectively zero, and
 *    closing it completely would require re-checking archival status
 *    from INSIDE the synchronous `scope`, which cannot branch on a read
 *    it cannot `await`. An `INSERT ... SELECT ... WHERE EXISTS (...)`
 *    guard was considered and rejected: unlike a rejected statement, a
 *    `WHERE` that matches zero rows inserts zero rows WITHOUT erroring —
 *    exactly the silent, undetectable one-leg-missing corruption this
 *    function exists to prevent, just moved one step earlier.
 *
 * Whatever `db.transaction()` itself rejects with, unmodified, if either
 * `INSERT` fails for a reason the checks above don't already cover (e.g.
 * a future `CHECK`/`FOREIGN KEY` this schema doesn't have yet) — in that
 * case NEITHER leg exists afterwards, by the atomicity guarantee above.
 *
 * Returns both legs' ids and the shared `transferGroupId`, not the full
 * rows — same convention as `insertFinance`; re-fetch via `getFinances`
 * for the resolved account/category shape.
 */
export const insertTransfer = async (
  db: SQLiteDatabase,
  {idAccountFrom, idAccountTo, amount, dateCreated}: IInsertTransferInput,
): Promise<IInsertTransferResult> => {
  if (!isFiniteInteger(amount) || amount <= 0) {
    throw new Error('amount must be a positive integer number of cents');
  }
  if (!Number.isInteger(idAccountFrom) || !Number.isInteger(idAccountTo)) {
    throw new Error('idAccountFrom and idAccountTo must be integer account ids');
  }
  if (idAccountFrom === idAccountTo) {
    throw new Error(
      'A transfer requires two different accounts: idAccountFrom must differ from idAccountTo',
    );
  }

  const [accountsResult] = await db.executeSql(
    'SELECT id, archivedAt FROM accounts WHERE id IN (?, ?)',
    [idAccountFrom, idAccountTo],
  );
  const accountsById = new Map<number, {archivedAt: string | null}>();
  for (let index = 0; index < accountsResult.rows.length; index++) {
    const row = accountsResult.rows.item(index);
    accountsById.set(row.id, {archivedAt: row.archivedAt ?? null});
  }
  for (const id of [idAccountFrom, idAccountTo]) {
    const account = accountsById.get(id);
    if (!account) {
      throw new Error(`Account ${id} does not exist`);
    }
    if (account.archivedAt !== null) {
      throw new Error(`Account ${id} is archived and cannot be used in a transfer`);
    }
  }

  const resolvedDateCreated = dateCreated ?? new Date().toISOString();
  const transferGroupId = generateTransferGroupId();

  const insertLegSql = `
    INSERT INTO finances (amount, dateCreated, idAccount, idCategory, transferGroupId)
    VALUES (?, ?, ?, NULL, ?)
  `;

  let legOutId: number | null = null;
  let legInId: number | null = null;

  await db.transaction(tx => {
    // DELIBERATELY not `async (tx) => {...}` — see this function's own
    // doc comment above for why an `await` between these two calls would
    // silently commit only the first leg. Both calls below run
    // synchronously, back to back, in the same scope invocation.
    tx.executeSql(
      insertLegSql,
      [-amount, resolvedDateCreated, idAccountFrom, transferGroupId],
      (_tx: Transaction, result: ResultSet) => {
        legOutId = result.insertId;
      },
    );
    tx.executeSql(
      insertLegSql,
      [amount, resolvedDateCreated, idAccountTo, transferGroupId],
      (_tx: Transaction, result: ResultSet) => {
        legInId = result.insertId;
      },
    );
  });

  if (legOutId === null || legInId === null) {
    // Should be unreachable against the REAL driver: `db.transaction()`
    // only resolves (commits) after every queued statement's success
    // callback has already run — see the `run()`/`finish()` pair in
    // `node_modules/react-native-sqlite-storage/lib/sqlite.core.js`. This
    // guards against a future driver version silently changing that
    // contract. NOTE: the Jest mock (`__mocks__/react-native-
    // sqlite-storage.js`) does NOT simulate this — its `transaction()`
    // invokes `scope` with a `tx.executeSql` that never calls back, so
    // this branch WOULD fire under the mock. No test in this repo calls
    // `insertTransfer`, so it doesn't today — see this slice's HANDOFF.
    throw new Error('insertTransfer: transaction committed without capturing both leg ids');
  }

  return {transferGroupId, legOutId, legInId};
};

/**
 * Deletes a transfer's two legs together, never one alone: `DELETE FROM
 * finances WHERE transferGroupId = ?`. Unlike `insertTransfer`, this
 * needs no explicit `db.transaction()` — a single SQL statement's effect
 * is already atomic on its own (SQLite runs one statement as one
 * unit even in this driver's plain autocommit mode), and one `DELETE`
 * matching both legs by their shared `transferGroupId` IS one statement.
 *
 * Idempotent: deleting an already-deleted (or never-existent)
 * `transferGroupId` matches zero rows and is not an error — same
 * "soft/idempotent by design" spirit as `archiveAccount`.
 *
 * Returns `deletedCount` (`rowsAffected`) so a caller CAN notice an
 * unexpected value if it wants to: by the invariant `insertTransfer`
 * establishes (every non-null `transferGroupId` is shared by EXACTLY two
 * rows, and no other function in this codebase writes or clears
 * `finances.transferGroupId`), this should always be `0` (nothing to
 * delete) or `2` (both legs removed) — never `1`. This function does not
 * throw on an unexpected count itself: throwing here couldn't undo a
 * partial delete that already happened (the `DELETE` already ran,
 * atomically, by the time this return value is inspected), so there is
 * nothing a throw would protect; it would only turn a symptom of
 * corruption elsewhere into an unrelated crash here.
 */
export const deleteTransfer = async (
  db: SQLiteDatabase,
  transferGroupId: string,
): Promise<{deletedCount: number}> => {
  const [result] = await db.executeSql(
    'DELETE FROM finances WHERE transferGroupId = ?',
    [transferGroupId],
  );
  return {deletedCount: result.rowsAffected};
};
