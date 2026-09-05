import {ResultSet, SQLiteDatabase, Transaction} from 'react-native-sqlite-storage';
import {isFiniteInteger} from './numberGuards';
import {getNetWorth} from './accountsQueries';

/**
 * Sobres — Fondos (ahorro, emergencia, seguridad, vacaciones) y Deudas
 * (préstamo estudiantil). Schema/rationale lives in
 * `src/db/migrations/005_envelopesAndCategoryBudgets.ts`; this file is
 * the query layer over `envelopes` + `envelope_movements`.
 *
 * ## "Aparta, no mueve" (product decision, not this agent's call — see
 * the migration file's top-of-file doc for the full write-up)
 *
 * `assignToEnvelope` below NEVER writes to `accounts`/`finances`. An
 * envelope's balance is `SUM(envelope_movements.amount) WHERE idEnvelope
 * = <this envelope>` — entirely separate derived state from
 * `initialBalance + SUM(finances.amount)` (`accountsQueries.ts`). Net
 * worth is computed from the latter only; assigning to an envelope never
 * moves it.
 *
 * ## Decision this agent WAS asked to make and had to resolve: can you
 * assign more to envelopes than actually exists across your accounts?
 *
 * Resolved as: ALLOWED, WITH A NON-BLOCKING SIGNAL — never rejected.
 *
 * `assignToEnvelope` computes `availableToAssign = netWorth -
 * totalApartado` (see `getAvailableToAssign` below) AFTER recording the
 * assignment, and returns it alongside an `overAllocated` convenience
 * flag (`availableToAssign < 0`). It never throws for this reason. Why:
 * - A `CHECK` constraint enforcing this is not possible in SQLite at all
 *   — `CHECK` cannot reference another table's aggregate.
 * - Hard-rejecting in the application layer instead would re-couple the
 *   envelope model to real-time account state — exactly the coupling
 *   "aparta, no mueve" exists to avoid. If assigning could FAIL based on
 *   today's account balances, an envelope's assignment history would
 *   again depend on the exact sequence/timing of unrelated account
 *   activity, which is precisely what a derived-but-independent ledger
 *   is supposed to not care about.
 * - Over-allocation is also a normal, legitimate use of an envelope
 *   system in the real world — "assign next month's expected paycheck to
 *   the emergency fund today, before it has arrived" — not a data-
 *   integrity error. A hard block would reject valid intent.
 *
 * The SAME policy is applied, symmetrically, to `withdrawFromEnvelope`:
 * withdrawing more than an envelope currently holds is also allowed,
 * also signalled (`envelopeOverdrawn: balance < 0` in its result), also
 * never blocked — for the identical reason: this is bookkeeping over a
 * virtual ledger, and the app/FE decides what a negative envelope
 * balance should mean to the user (most likely: "you've applied more
 * payments/spending than you'd apartado — catch up assigning"), not this
 * query layer.
 *
 * NOTE FOR THE NEXT REVIEWER: this is this agent's resolution of a gap
 * the product brief explicitly left open, not a decision already made by
 * product. If it turns out wrong (e.g. product wants a hard block after
 * all), the fix is entirely inside `assignToEnvelope`/
 * `withdrawFromEnvelope` below — nothing about the schema needs to
 * change either way.
 *
 * ## What "envelope_movements" does NOT know about
 *
 * There is no `idAccount`/`idCategory` column on `envelope_movements` and
 * no `FOREIGN KEY` from it to `finances`. If the app wants "paying rent
 * from the emergency fund" to both (a) record a real expense against an
 * account/category in `finances`, AND (b) withdraw from the "Emergencia"
 * envelope to reflect that the apartado money was used — that is TWO
 * separate writes the caller (BE/hook layer) is responsible for making,
 * not one atomic operation this schema provides. Linking them was not
 * asked for in this slice and would add real scope (should it be
 * atomic? what if only one of the two rows should exist on undo?) that
 * belongs in a future slice, not silently built in here.
 */

/**
 * La nota que lleva el retiro de cierre de `completeEnvelope`. No es lo
 * que identifica ese movimiento —eso lo hace
 * `envelopes.closingMovementId`— pero si es lo que el usuario lee si
 * abre el historial del sobre, y lo que el propio `UPDATE` usa para
 * recuperar el id recien insertado dentro de la misma transaccion.
 */
const ENVELOPE_CLOSING_NOTE = 'Meta cumplida';

export type EnvelopeKind = 'fund' | 'debt';

export const ENVELOPE_KINDS: readonly EnvelopeKind[] = ['fund', 'debt'] as const;

const isValidEnvelopeKind = (kind: string): kind is EnvelopeKind =>
  (ENVELOPE_KINDS as readonly string[]).includes(kind);

/** One envelope row as stored, with NO derived balance. */
export interface IEnvelope {
  id: number;
  name: string;
  icon: string;
  kind: EnvelopeKind;
  /** Cents. `null` for a `fund` envelope with no savings goal set; NEVER
   * `null` for a `debt` envelope (enforced by the DB `CHECK` — see the
   * migration). For `debt`, this is the ORIGINAL amount owed, fixed at
   * creation — it is not "how much is left", see `remainingDebt` below
   * for that. */
  targetAmount: number | null;
  archivedAt: string | null;
  /** ISO-8601 del momento en que se marco como CUMPLIDO, o `null`. Ver
   * la migracion 008 para por que no es lo mismo que `archivedAt`. */
  completedAt: string | null;
  /** `envelope_movements.id` del retiro de cierre que hizo
   * `completeEnvelope`, o `null` (sobre no cumplido, o cumplido con
   * saldo cero, que no genera retiro). Lo usa `reopenEnvelope`. */
  closingMovementId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `IEnvelope` plus DERIVED values, computed at read time, never stored:
 * - `balance`: `SUM(envelope_movements.amount)` — the current apartado
 *   balance (assignments minus withdrawals). Can be negative — see this
 *   file's top-of-file doc on withdrawals exceeding assignments.
 * - `paidAmount`: `fund` envelopes → always `null` (the concept does not
 *   apply). `debt` envelopes → `ABS(SUM(amount)) over this envelope's
 *   NEGATIVE movements` — i.e. total money actually WITHDRAWN from (=
 *   applied as payment toward) this debt envelope. This is "cuánto se ha
 *   pagado". It is intentionally NOT the same number as `balance`:
 *   `balance` is what is CURRENTLY apartado and unspent, `paidAmount` is
 *   the running total ever consumed — a debt envelope can have
 *   `paidAmount = 500` and `balance = 200` simultaneously (700 assigned
 *   in total, 500 already applied as payments, 200 still sitting
 *   apartado waiting for the next payment).
 * - `remainingDebt`: `fund` envelopes → always `null`. `debt` envelopes →
 *   `targetAmount - paidAmount` — "cuánto falta". This is "de cuánto" the
 *   task asked for, made explicit so the FE never has to compute it
 *   itself. Can go negative if `paidAmount` ever exceeds `targetAmount`
 *   (an overpayment) — returned as-is, not clamped to 0, so the FE can
 *   decide how to present an overpaid debt.
 */
export interface IEnvelopeWithBalance extends IEnvelope {
  balance: number;
  paidAmount: number | null;
  remainingDebt: number | null;
  /**
   * Cents, `>= 0`. TODO lo que se ha asignado a este sobre a lo largo de
   * su vida — `SUM` de los movimientos positivos, sin restar retiros.
   *
   * No es el saldo y no lo sustituye. Existe porque hay una pregunta
   * que el saldo no puede responder despues de cerrar un sobre: cuanto
   * llegaste a ahorrar. `completeEnvelope` retira el saldo hasta cero,
   * asi que un fondo cumplido SIN meta (`targetAmount NULL`, que el
   * esquema permite) no tendria ninguna cifra que celebrar en Logros.
   */
  assignedTotal: number;
}

export interface IInsertEnvelopeInput {
  name: string;
  icon: string;
  kind: EnvelopeKind;
  /** Cents. Required (and validated `> 0`) if `kind === 'debt'`; optional
   * for `kind === 'fund'`. */
  targetAmount?: number;
  /** ISO-8601. Defaults to `new Date().toISOString()` if omitted. */
  createdAt?: string;
  /** ISO-8601. Defaults to `new Date().toISOString()` if omitted. */
  updatedAt?: string;
}

/**
 * `kind` is intentionally NOT editable here (or anywhere in this file).
 * Unlike `name`/`icon` (pure display fields), `kind` determines what
 * `balance`/`paidAmount`/`remainingDebt` even MEAN for a row — flipping a
 * `fund` into a `debt` mid-life (or vice versa) would silently change the
 * meaning of every past movement already recorded against it. If a
 * `fund` envelope was really meant to be a `debt` envelope (or vice
 * versa), archive it and create a new one instead. This is this agent's
 * own implementation call (not dictated by the task), flagged here for
 * visibility, not a re-litigation of any product decision.
 */
export interface IUpdateEnvelopeInput {
  name?: string;
  icon?: string;
  /** Cents, `> 0`, or explicit `null` to clear a `fund`'s optional goal.
   * Throws if the envelope is `kind === 'debt'` and this would clear
   * `targetAmount` — a debt's target is required, never optional. */
  targetAmount?: number | null;
}

export interface IGetEnvelopesOptions {
  /** Defaults to `false`. */
  includeArchived?: boolean;
  /** Defaults to `false`. Un sobre CUMPLIDO ya no es parte de la lista
   * activa: vive en Logros (`getCompletedEnvelopes`). */
  includeCompleted?: boolean;
  /** Filter to one kind — e.g. the Fondos tab vs. the Deudas tab, or the
   * per-kind pie-chart breakdowns. */
  kind?: EnvelopeKind;
}

const mapRowToEnvelopeWithBalance = (row: any): IEnvelopeWithBalance => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  kind: row.kind,
  targetAmount: row.targetAmount ?? null,
  archivedAt: row.archivedAt ?? null,
  completedAt: row.completedAt ?? null,
  closingMovementId: row.closingMovementId ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  balance: row.balance,
  paidAmount: row.paidAmount ?? null,
  remainingDebt: row.remainingDebt ?? null,
  assignedTotal: row.assignedTotal ?? 0,
});

/**
 * Shared SELECT for every read below: joins each envelope to a
 * per-envelope aggregate over `envelope_movements` computed in ONE pass —
 * `total` (→ `balance`), `assigned` (→ `assignedTotal`) and `withdrawn`
 * (→ `paidAmount`, `debt` only) —
 * both derived from the same `SUM`/`CASE` expressions over the single
 * covering index `idx_envelope_movements_idEnvelope_amount(idEnvelope,
 * amount)` (see the migration), so SQLite never touches
 * `envelope_movements`' actual rows to answer this. An envelope with zero
 * movements still returns `balance = 0` (`COALESCE`), not `NULL`.
 */
const ENVELOPES_WITH_BALANCE_SELECT = `
  SELECT
    e.id AS id,
    e.name AS name,
    e.icon AS icon,
    e.kind AS kind,
    e.targetAmount AS targetAmount,
    e.archivedAt AS archivedAt,
    e.completedAt AS completedAt,
    e.closingMovementId AS closingMovementId,
    e.createdAt AS createdAt,
    e.updatedAt AS updatedAt,
    COALESCE(m.total, 0) AS balance,
    COALESCE(m.assigned, 0) AS assignedTotal,
    CASE WHEN e.kind = 'debt' THEN COALESCE(m.withdrawn, 0) ELSE NULL END AS paidAmount,
    CASE WHEN e.kind = 'debt' THEN e.targetAmount - COALESCE(m.withdrawn, 0) ELSE NULL END AS remainingDebt
  FROM envelopes e
  LEFT JOIN (
    SELECT
      idEnvelope,
      SUM(amount) AS total,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS assigned,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS withdrawn
    FROM envelope_movements
    GROUP BY idEnvelope
  ) m ON m.idEnvelope = e.id
`;

/**
 * Inserts one envelope.
 *
 * Throws:
 * - `Error('Invalid envelope kind: ...')` if `kind` is not one of
 *   `ENVELOPE_KINDS`.
 * - `Error('targetAmount must be a positive integer number of cents')` if
 *   `targetAmount` is passed and is not a safe, positive integer.
 * - `Error('targetAmount is required for a debt envelope')` if `kind ===
 *   'debt'` and `targetAmount` is omitted — defense in depth alongside
 *   the DB's own `CHECK (kind <> 'debt' OR targetAmount IS NOT NULL)`,
 *   checked BEFORE the insert so this specific case gets a clear message
 *   instead of a generic SQLite constraint-failure string.
 *
 * Returns the new row's `id`, not the full row.
 */
export const insertEnvelope = async (
  db: SQLiteDatabase,
  input: IInsertEnvelopeInput,
): Promise<{id: number}> => {
  if (!isValidEnvelopeKind(input.kind)) {
    throw new Error(`Invalid envelope kind: ${input.kind}`);
  }
  if (input.targetAmount !== undefined && (!isFiniteInteger(input.targetAmount) || input.targetAmount <= 0)) {
    throw new Error('targetAmount must be a positive integer number of cents');
  }
  if (input.kind === 'debt' && input.targetAmount === undefined) {
    throw new Error('targetAmount is required for a debt envelope');
  }

  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;

  const [result] = await db.executeSql(
    `INSERT INTO envelopes (name, icon, kind, targetAmount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [input.name, input.icon, input.kind, input.targetAmount ?? null, createdAt, updatedAt],
  );
  return {id: result.insertId};
};

/**
 * Partially updates an envelope's `name`/`icon`/`targetAmount`. `kind` is
 * not updatable — see `IUpdateEnvelopeInput`'s doc. `undefined` fields
 * are left untouched; passing no fields is a no-op (no `UPDATE` issued).
 * Always bumps `updatedAt` when at least one field changes.
 *
 * Throws:
 * - `Error('targetAmount must be a positive integer number of cents')` if
 *   `targetAmount` is passed as a non-`null` value that is not a safe,
 *   positive integer.
 * - `Error('targetAmount cannot be cleared for a debt envelope')` if
 *   `targetAmount: null` is passed for an envelope whose `kind` is
 *   `'debt'` — requires one extra `SELECT kind ...` read before the
 *   `UPDATE`, same "read what's needed to give a specific error message
 *   before issuing the write" pattern `insertFinance` uses for resolving
 *   a category's type.
 */
export const updateEnvelope = async (
  db: SQLiteDatabase,
  id: number,
  input: IUpdateEnvelopeInput,
): Promise<void> => {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (input.name !== undefined) {
    sets.push('name = ?');
    params.push(input.name);
  }
  if (input.icon !== undefined) {
    sets.push('icon = ?');
    params.push(input.icon);
  }
  if (input.targetAmount !== undefined) {
    if (input.targetAmount === null) {
      const [kindResult] = await db.executeSql('SELECT kind FROM envelopes WHERE id = ?', [id]);
      const currentKind = kindResult.rows.length > 0 ? kindResult.rows.item(0).kind : null;
      if (currentKind === 'debt') {
        throw new Error('targetAmount cannot be cleared for a debt envelope');
      }
    } else if (!isFiniteInteger(input.targetAmount) || input.targetAmount <= 0) {
      throw new Error('targetAmount must be a positive integer number of cents');
    }
    sets.push('targetAmount = ?');
    params.push(input.targetAmount);
  }

  if (sets.length === 0) {
    return;
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(id);

  await db.executeSql(`UPDATE envelopes SET ${sets.join(', ')} WHERE id = ?`, params);
};

/**
 * Soft-deletes an envelope by stamping `archivedAt`. Idempotent, same
 * shape as `archiveAccount`. Envelopes with movement history are never
 * physically deleted — `envelope_movements.idEnvelope` is a `NOT NULL
 * FOREIGN KEY` to this table.
 */
export const archiveEnvelope = async (
  db: SQLiteDatabase,
  id: number,
  archivedAt?: string,
): Promise<void> => {
  const resolved = archivedAt ?? new Date().toISOString();
  await db.executeSql(
    'UPDATE envelopes SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL',
    [resolved, resolved, id],
  );
};

/** Reverses `archiveEnvelope`. Idempotent, same shape as
 * `unarchiveAccount`. */
export const unarchiveEnvelope = async (db: SQLiteDatabase, id: number): Promise<void> => {
  const now = new Date().toISOString();
  await db.executeSql(
    'UPDATE envelopes SET archivedAt = NULL, updatedAt = ? WHERE id = ? AND archivedAt IS NOT NULL',
    [now, id],
  );
};

/* ------------------------------------------------------------------ *
 *  Cumplir un sobre (Logros)
 * ------------------------------------------------------------------ */

/** Lo que `completeEnvelope` puede rechazar, para que la capa de UI
 * distinga "todavia no llegaste" de "esto ya estaba cumplido" sin
 * comparar cadenas de error. */
export type CompleteEnvelopeRejection = 'notFound' | 'alreadyCompleted' | 'goalNotReached';

export interface ICompleteEnvelopeResult {
  /** `null` si se completo. */
  rejectedBecause: CompleteEnvelopeRejection | null;
  /** Cents retirados al cerrar. `0` si el sobre no tenia saldo. */
  withdrawn: number;
}

/**
 * `true` si el sobre alcanzo su meta y por tanto puede completarse.
 *
 * Pura, exportada, y es la MISMA funcion que usa la UI para decidir si
 * pinta el CTA de "Marcar completado". Que la regla viva en un solo
 * sitio importa: si la pantalla y la consulta la calcularan por
 * separado, el boton podria ofrecerse justo cuando la escritura lo va a
 * rechazar.
 *
 * - Deuda: `paidAmount >= targetAmount`. Pagar una deuda es RETIRAR del
 *   sobre (ver `withdrawFromEnvelope`), asi que lo que cuenta es lo
 *   retirado, no lo apartado.
 * - Fondo CON meta: `balance >= targetAmount`.
 * - Fondo SIN meta: cumplible en cuanto tenga saldo. El esquema permite
 *   `targetAmount NULL` solo en los fondos, y un fondo sin meta nunca
 *   llegaria al 100% de nada — pero cerrarlo sigue siendo un logro
 *   legitimo ("ahorre $3,200 y me lo gaste en lo que queria"), asi que
 *   el unico requisito ahi es que haya algo que celebrar.
 */
export const hasReachedGoal = (envelope: IEnvelopeWithBalance): boolean => {
  if (envelope.kind === 'debt') {
    return envelope.targetAmount !== null && (envelope.paidAmount ?? 0) >= envelope.targetAmount;
  }
  if (envelope.targetAmount === null) {
    return envelope.balance > 0;
  }
  return envelope.balance >= envelope.targetAmount;
};

/**
 * Marca un sobre como cumplido y RETIRA todo su saldo en la misma
 * transaccion.
 *
 * ## Por que retira
 *
 * Decision de producto tomada explicitamente con el dueno del proyecto
 * (2026-09-04). Un fondo de $10,000 para un viaje ya hecho no puede
 * seguir sumando a "Dinero apartado" ni a "Ahorros" del Balance: seria
 * dinero contado dos veces. El retiro NO toca ninguna cuenta ni crea
 * fila alguna en `finances` — un sobre solo aparta dinero, nunca lo
 * mueve (ver el doc de cabecera de este archivo) — asi que cerrar un
 * sobre no puede alterar ningun saldo real. Aplica igual a las deudas:
 * lo que quede apartado sin retirar deja de estar comprometido.
 *
 * ## Por que el importe se calcula DENTRO del INSERT
 *
 * Leer el saldo con un `SELECT` y despues insertar `-saldo` abriria una
 * ventana entre las dos operaciones en la que una asignacion podria
 * colarse y dejar el sobre cerrado con saldo distinto de cero. El
 * `INSERT ... SELECT ... HAVING` de abajo calcula la suma y la inserta
 * en un solo paso atomico. El `HAVING` ademas evita insertar cuando el
 * saldo es cero, que violaria el `CHECK (amount <> 0)` de la tabla.
 *
 * El callback de la transaccion es DELIBERADAMENTE sincrono, igual que
 * en `insertTransfer`: un `await` entre las dos sentencias dejaria
 * confirmado el retiro sin marcar el sobre como cumplido.
 *
 * No lanza por una precondicion incumplida — devuelve `rejectedBecause`.
 * Esto no es un error de programacion sino una carrera normal: el
 * usuario pudo retirar dinero desde otra pantalla entre que vio el CTA
 * y lo toco.
 */
export const completeEnvelope = async (
  db: SQLiteDatabase,
  id: number,
  completedAt?: string,
): Promise<ICompleteEnvelopeResult> => {
  const envelope = await getEnvelopeById(db, id);
  if (envelope === null) {
    return {rejectedBecause: 'notFound', withdrawn: 0};
  }
  if (envelope.completedAt !== null) {
    return {rejectedBecause: 'alreadyCompleted', withdrawn: 0};
  }
  if (!hasReachedGoal(envelope)) {
    return {rejectedBecause: 'goalNotReached', withdrawn: 0};
  }

  const resolved = completedAt ?? new Date().toISOString();
  let closingMovementId: number | null = null;

  await db.transaction(tx => {
    // Sin `async`: ver el doc de arriba.
    tx.executeSql(
      `INSERT INTO envelope_movements (idEnvelope, amount, dateCreated, note)
         SELECT ?, -COALESCE(SUM(amount), 0), ?, ?
           FROM envelope_movements
          WHERE idEnvelope = ?
         HAVING COALESCE(SUM(amount), 0) > 0`,
      [id, resolved, ENVELOPE_CLOSING_NOTE, id],
      // El `UPDATE` se lanza DESDE este callback, no encolado detras del
      // `INSERT`, porque necesita el `insertId` y los parametros de una
      // sentencia encolada se fijan en el momento de encolarla — cuando
      // este callback todavia no ha corrido. Sigue siendo la misma
      // transaccion: `innerTx` ES la transaccion en curso.
      //
      // La alternativa era que el `UPDATE` se buscara el id solo, con un
      // `SELECT MAX(id) ... WHERE note = 'Meta cumplida'`. Se descarto:
      // la nota es texto libre que el usuario ve y puede escribir igual
      // en un retiro suyo, y entonces deshacer borraria el movimiento
      // equivocado.
      (innerTx: Transaction, result: ResultSet) => {
        closingMovementId = result.rowsAffected > 0 ? result.insertId : null;
        innerTx.executeSql(
          `UPDATE envelopes
              SET completedAt = ?, closingMovementId = ?, updatedAt = ?
            WHERE id = ? AND completedAt IS NULL`,
          [resolved, closingMovementId, resolved, id],
        );
      },
    );
  });

  // El saldo leido un instante antes de la transaccion. Solo alimenta el
  // mensaje de confirmacion; el importe que de verdad se retiro lo
  // calculo SQLite dentro del `INSERT`.
  return {rejectedBecause: null, withdrawn: closingMovementId === null ? 0 : envelope.balance};
};

/**
 * Deshace `completeEnvelope`: el sobre vuelve a la lista activa con su
 * saldo intacto.
 *
 * Existe desde el primer dia, no como mejora posterior. Completar
 * retira dinero, asi que sin deshacer un toque equivocado seria
 * irreversible — y este proyecto ya tiene un precedente de eso:
 * `unarchiveEnvelope` lleva desde su creacion sin un solo llamador, lo
 * que convierte archivar en un viaje de ida.
 *
 * Borra el retiro de cierre por su `id` guardado, nunca "el ultimo
 * movimiento" ni uno buscado por fecha: entre completar y deshacer no
 * puede haber movimientos nuevos (el sobre esta fuera de la lista
 * activa), pero apoyarse en eso seria depender de una invariante que
 * cualquier pantalla futura podria romper.
 *
 * Idempotente: sobre un sobre no cumplido no hace nada.
 */
export const reopenEnvelope = async (db: SQLiteDatabase, id: number): Promise<void> => {
  const envelope = await getEnvelopeById(db, id);
  if (envelope === null || envelope.completedAt === null) {
    return;
  }
  const now = new Date().toISOString();
  const movementId = envelope.closingMovementId;

  await db.transaction(tx => {
    // Se limpia el puntero ANTES de borrar la fila: al reves quedaria,
    // por un instante dentro de la transaccion, un id apuntando a nada.
    tx.executeSql(
      'UPDATE envelopes SET completedAt = NULL, closingMovementId = NULL, updatedAt = ? WHERE id = ?',
      [now, id],
    );
    if (movementId !== null) {
      tx.executeSql('DELETE FROM envelope_movements WHERE id = ?', [movementId]);
    }
  });
};

/**
 * Los sobres cumplidos, lo mas reciente primero — la pantalla de
 * Logros.
 *
 * Devuelve el mismo `IEnvelopeWithBalance` que el resto del archivo,
 * aunque su `balance` sea siempre `0` tras el cierre: lo que la
 * pantalla muestra es `targetAmount` (la meta) y, en las deudas,
 * `paidAmount` (lo pagado), que sobreviven al retiro porque salen de
 * los movimientos, no del saldo.
 *
 * Ordenado por `completedAt DESC` sobre `idx_envelopes_completed`, el
 * indice parcial que la migracion 008 crea justo para esta consulta.
 */
export const getCompletedEnvelopes = async (
  db: SQLiteDatabase,
): Promise<IEnvelopeWithBalance[]> => {
  const [resultSet] = await db.executeSql(
    `${ENVELOPES_WITH_BALANCE_SELECT}
     WHERE e.completedAt IS NOT NULL
     ORDER BY e.completedAt DESC, e.id DESC;`,
  );
  const envelopes: IEnvelopeWithBalance[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    envelopes.push(mapRowToEnvelopeWithBalance(resultSet.rows.item(index)));
  }
  return envelopes;
};

/**
 * Lists envelopes (active only by default) with derived `balance`/
 * `paidAmount`/`remainingDebt` — see `ENVELOPES_WITH_BALANCE_SELECT`.
 * Ordered by `name` for a stable UI list, same as `getAccounts` — this
 * table is expected to stay small (a handful of sobres per user).
 *
 * `opts.kind` backs the Fondos/Deudas tab split and the pie-chart
 * breakdowns (each row's `balance`/`remainingDebt` IS one pie slice,
 * already aggregated in SQL — no summing in JS needed to render a
 * slice).
 */
export const getEnvelopes = async (
  db: SQLiteDatabase,
  opts: IGetEnvelopesOptions = {},
): Promise<IEnvelopeWithBalance[]> => {
  const conditions: string[] = [];
  const params: string[] = [];
  if (!opts.includeArchived) {
    conditions.push('e.archivedAt IS NULL');
  }
  if (!opts.includeCompleted) {
    conditions.push('e.completedAt IS NULL');
  }
  if (opts.kind !== undefined) {
    conditions.push('e.kind = ?');
    params.push(opts.kind);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [resultSet] = await db.executeSql(
    `${ENVELOPES_WITH_BALANCE_SELECT} ${whereClause} ORDER BY e.name ASC;`,
    params,
  );

  const envelopes: IEnvelopeWithBalance[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    envelopes.push(mapRowToEnvelopeWithBalance(resultSet.rows.item(index)));
  }
  return envelopes;
};

/** Same derived shape as `getEnvelopes`, for exactly one envelope
 * (archived or not). Returns `null` if no such envelope exists. */
export const getEnvelopeById = async (
  db: SQLiteDatabase,
  id: number,
): Promise<IEnvelopeWithBalance | null> => {
  const [resultSet] = await db.executeSql(`${ENVELOPES_WITH_BALANCE_SELECT} WHERE e.id = ?;`, [id]);
  if (resultSet.rows.length === 0) {
    return null;
  }
  return mapRowToEnvelopeWithBalance(resultSet.rows.item(0));
};

/**
 * The total currently apartado across ACTIVE envelopes (archived
 * excluded, same convention as `getNetWorth`'s account filter), computed
 * as a single `SUM` inside SQLite — never `(await getEnvelopes(db)).
 * reduce(...)`. Cents.
 *
 * - No `opts.kind` → every envelope regardless of kind: this is the
 *   headline "Apartado $X" number the approved Analítica prototype shows.
 * - `opts.kind: 'fund'` → total saved across Fondos (a pie chart's
 *   headline total).
 * - `opts.kind: 'debt'` → total currently apartado FOR debts (money set
 *   aside waiting to be applied as payments) — NOT the same number as
 *   `getTotalRemainingDebt` below (how much debt is still owed); see that
 *   function's doc for which one the debts pie chart actually wants.
 */
export const getEnvelopesTotal = async (
  db: SQLiteDatabase,
  opts: {kind?: EnvelopeKind; includeArchived?: boolean} = {},
): Promise<number> => {
  const conditions: string[] = [];
  const params: string[] = [];
  if (!opts.includeArchived) {
    conditions.push('e.archivedAt IS NULL');
  }
  // Los cumplidos quedan fuera SIEMPRE, sin flag. `completeEnvelope`
  // retira todo su saldo, asi que un sobre cumplido aporta 0 a esta
  // suma: incluirlo o no da el mismo numero. Se excluye igualmente para
  // que la consulta diga lo que quiere decir —"lo apartado AHORA"— y no
  // dependa de esa invariante para ser correcta.
  conditions.push('e.completedAt IS NULL');
  if (opts.kind !== undefined) {
    conditions.push('e.kind = ?');
    params.push(opts.kind);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [resultSet] = await db.executeSql(
    `SELECT COALESCE(SUM(a.amount), 0) AS total
      FROM envelope_movements a
      JOIN envelopes e ON e.id = a.idEnvelope
      ${whereClause};`,
    params,
  );
  return resultSet.rows.item(0).total;
};

/**
 * Total remaining debt across ACTIVE `debt` envelopes —
 * `SUM(targetAmount - paidAmount)`, i.e. "cuánto falta por pagar" summed
 * over every loan. THIS is the number the Deudas pie chart's headline
 * total should use (each envelope's own `remainingDebt` from
 * `getEnvelopes({kind: 'debt'})` is the matching per-slice value) — NOT
 * `getEnvelopesTotal({kind: 'debt'})`, which answers a different question
 * (money apartado waiting to be applied, not debt still owed). Cents;
 * `0` if there are no active debt envelopes.
 */
export const getTotalRemainingDebt = async (
  db: SQLiteDatabase,
  opts: {includeArchived?: boolean} = {},
): Promise<number> => {
  // Idem: una deuda cumplida esta saldada por definicion. Incluirla
  // seria peor que inocuo — si se pago de mas, `targetAmount - withdrawn`
  // es NEGATIVO y restaria de la deuda de los demas sobres.
  const whereClause = `AND e.completedAt IS NULL ${opts.includeArchived ? '' : 'AND e.archivedAt IS NULL'}`;
  const [resultSet] = await db.executeSql(
    `SELECT COALESCE(SUM(e.targetAmount - COALESCE(m.withdrawn, 0)), 0) AS total
      FROM envelopes e
      LEFT JOIN (
        SELECT idEnvelope, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS withdrawn
        FROM envelope_movements
        GROUP BY idEnvelope
      ) m ON m.idEnvelope = e.id
      WHERE e.kind = 'debt' ${whereClause};`,
  );
  return resultSet.rows.item(0).total;
};

/**
 * `netWorth - totalApartado` (all active envelopes, every kind) — "money
 * not yet claimed by any envelope". Negative means more has been
 * assigned across envelopes in total than currently exists across active
 * accounts (see this file's top-of-file doc on why that is ALLOWED, not
 * rejected). Cents. Exported directly (not just used internally by
 * `assignToEnvelope`) so a "create/edit assignment" form can show
 * "$X disponible para asignar" before the user even submits.
 */
export const getAvailableToAssign = async (db: SQLiteDatabase): Promise<number> => {
  const [netWorth, totalApartado] = await Promise.all([getNetWorth(db), getEnvelopesTotal(db)]);
  return netWorth - totalApartado;
};

export interface IEnvelopeMovement {
  id: number;
  idEnvelope: number;
  /** Signed cents: positive = assignment, negative = withdrawal. */
  amount: number;
  dateCreated: string;
  note: string | null;
}

export interface IAssignToEnvelopeInput {
  idEnvelope: number;
  /** MAGNITUDE, positive cents — this function always records an
   * ASSIGNMENT (positive movement); see `withdrawFromEnvelope` for the
   * inverse. Passing an already-signed value would be double-applied. */
  amount: number;
  /** ISO-8601. Defaults to `new Date().toISOString()` if omitted. */
  dateCreated?: string;
  note?: string;
}

export interface IAssignToEnvelopeResult {
  id: number;
  /** `getAvailableToAssign`'s value AFTER this assignment is recorded. */
  availableToAssign: number;
  /** `availableToAssign < 0` — convenience flag; never blocks the
   * assignment, see this file's top-of-file doc. */
  overAllocated: boolean;
}

/**
 * Records an assignment (apartar dinero) into an envelope.
 *
 * Throws:
 * - `Error('amount must be a positive integer number of cents')` if
 *   `amount` is not a safe, positive integer.
 * - `Error('Envelope <id> does not exist')` if `idEnvelope` does not
 *   resolve to a row in `envelopes` — checked explicitly with a SELECT
 *   before the insert, same reason `insertFinance` pre-checks
 *   `idCategory`: this function needs to know the envelope exists before
 *   it can meaningfully return `availableToAssign` either way, and a
 *   dedicated message beats a generic FK-violation string.
 * - Whatever `db.executeSql` rejects with, unmodified, for any other
 *   insert failure.
 *
 * Never throws for "this assigns more than exists across accounts" —
 * see this file's top-of-file doc; that case is reported via
 * `overAllocated`/`availableToAssign` in the returned value instead.
 */
export const assignToEnvelope = async (
  db: SQLiteDatabase,
  {idEnvelope, amount, dateCreated, note}: IAssignToEnvelopeInput,
): Promise<IAssignToEnvelopeResult> => {
  if (!isFiniteInteger(amount) || amount <= 0) {
    throw new Error('amount must be a positive integer number of cents');
  }
  const [envelopeResult] = await db.executeSql('SELECT id FROM envelopes WHERE id = ?', [idEnvelope]);
  if (envelopeResult.rows.length === 0) {
    throw new Error(`Envelope ${idEnvelope} does not exist`);
  }

  const resolvedDateCreated = dateCreated ?? new Date().toISOString();
  const [result] = await db.executeSql(
    'INSERT INTO envelope_movements (idEnvelope, amount, dateCreated, note) VALUES (?, ?, ?, ?)',
    [idEnvelope, amount, resolvedDateCreated, note ?? null],
  );

  const availableToAssign = await getAvailableToAssign(db);
  return {id: result.insertId, availableToAssign, overAllocated: availableToAssign < 0};
};

export interface IWithdrawFromEnvelopeInput {
  idEnvelope: number;
  /** MAGNITUDE, positive cents — this function always records a
   * WITHDRAWAL (negative movement). For a `debt` envelope, a withdrawal
   * IS a payment applied toward the debt (increases `paidAmount`,
   * decreases `remainingDebt`). */
  amount: number;
  /** ISO-8601. Defaults to `new Date().toISOString()` if omitted. */
  dateCreated?: string;
  note?: string;
}

export interface IWithdrawFromEnvelopeResult {
  id: number;
  /** This envelope's `balance` AFTER this withdrawal is recorded. */
  balance: number;
  /** `balance < 0` — this withdrawal consumed more than the envelope
   * currently held apartado. Never blocks the withdrawal, same policy as
   * `overAllocated` above — see this file's top-of-file doc. */
  envelopeOverdrawn: boolean;
}

/**
 * Records a withdrawal (consumo) from an envelope.
 *
 * Throws the same `amount`/`Envelope <id> does not exist` errors as
 * `assignToEnvelope`. Never throws for "this withdraws more than the
 * envelope currently holds" — reported via `envelopeOverdrawn`/`balance`
 * instead.
 */
export const withdrawFromEnvelope = async (
  db: SQLiteDatabase,
  {idEnvelope, amount, dateCreated, note}: IWithdrawFromEnvelopeInput,
): Promise<IWithdrawFromEnvelopeResult> => {
  if (!isFiniteInteger(amount) || amount <= 0) {
    throw new Error('amount must be a positive integer number of cents');
  }
  const [envelopeResult] = await db.executeSql('SELECT id FROM envelopes WHERE id = ?', [idEnvelope]);
  if (envelopeResult.rows.length === 0) {
    throw new Error(`Envelope ${idEnvelope} does not exist`);
  }

  const resolvedDateCreated = dateCreated ?? new Date().toISOString();
  const [result] = await db.executeSql(
    'INSERT INTO envelope_movements (idEnvelope, amount, dateCreated, note) VALUES (?, ?, ?, ?)',
    [idEnvelope, -amount, resolvedDateCreated, note ?? null],
  );

  const envelope = await getEnvelopeById(db, idEnvelope);
  // Unreachable in practice — the row was confirmed to exist immediately
  // above and nothing here can delete it in between (no other statement
  // runs). Guards the type (`getEnvelopeById` returns `| null`) rather
  // than asserting.
  const balance = envelope?.balance ?? -amount;
  return {id: result.insertId, balance, envelopeOverdrawn: balance < 0};
};

/** Keyset cursor: the last row's `(dateCreated, id)` from the previous page. */
export interface IEnvelopeMovementsCursor {
  dateCreated: string;
  id: number;
}

export interface IGetEnvelopeMovementsOptions {
  /** Defaults to 20. */
  limit?: number;
  /** Opaque cursor from the previous page's `nextCursor`; omit for page 1. */
  cursor?: IEnvelopeMovementsCursor;
}

export interface IGetEnvelopeMovementsResult {
  items: IEnvelopeMovement[];
  nextCursor: IEnvelopeMovementsCursor | null;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Lists one envelope's movements newest-first, keyset-paginated — same
 * pattern as `getFinances`, backed by
 * `idx_envelope_movements_idEnvelope_date`. Never returns more than
 * `limit` (default 20) rows regardless of history size.
 */
export const getEnvelopeMovements = async (
  db: SQLiteDatabase,
  idEnvelope: number,
  opts: IGetEnvelopeMovementsOptions = {},
): Promise<IGetEnvelopeMovementsResult> => {
  const limit = opts.limit ?? DEFAULT_PAGE_SIZE;

  const conditions: string[] = ['idEnvelope = ?'];
  const params: (string | number)[] = [idEnvelope];

  if (opts.cursor) {
    conditions.push('(dateCreated < ? OR (dateCreated = ? AND id < ?))');
    params.push(opts.cursor.dateCreated, opts.cursor.dateCreated, opts.cursor.id);
  }

  params.push(limit + 1);

  const [resultSet] = await db.executeSql(
    `SELECT id, idEnvelope, amount, dateCreated, note
      FROM envelope_movements
      WHERE ${conditions.join(' AND ')}
      ORDER BY dateCreated DESC, id DESC
      LIMIT ?;`,
    params,
  );

  const rows: IEnvelopeMovement[] = [];
  for (let index = 0; index < resultSet.rows.length; index++) {
    const row = resultSet.rows.item(index);
    rows.push({
      id: row.id,
      idEnvelope: row.idEnvelope,
      amount: row.amount,
      dateCreated: row.dateCreated,
      note: row.note ?? null,
    });
  }

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor: IEnvelopeMovementsCursor | null =
    hasNextPage && last ? {dateCreated: last.dateCreated, id: last.id} : null;

  return {items, nextCursor};
};
