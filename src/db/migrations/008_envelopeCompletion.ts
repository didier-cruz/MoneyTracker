/**
 * Migration `user_version` 8.
 *
 * Marcar un sobre como CUMPLIDO: una meta de ahorro alcanzada o una
 * deuda saldada pasan a la pantalla de Logros en lugar de seguir
 * ocupando sitio en la lista activa.
 *
 * --- Por que dos columnas y no una tabla `achievements` ---
 *
 * El sobre YA es el registro del logro: guarda el nombre, el icono, la
 * meta, la fecha de creacion y todos sus movimientos. Una tabla aparte
 * tendria que copiar esos datos y quedaria desincronizada el dia que el
 * usuario renombre el sobre o le cambie el icono. Aqui basta con marcar
 * CUANDO se cumplio.
 *
 * --- Por que `completedAt` es distinto de `archivedAt` ---
 *
 * Los dos esconden el sobre de la lista activa, pero significan cosas
 * opuestas y el usuario las distingue perfectamente:
 *
 * - `archivedAt`  = lo abandone, o lo cree mal. No se celebra.
 * - `completedAt` = lo logre. Va a Logros.
 *
 * Son ortogonales a proposito: completar NO archiva. Un sobre cumplido
 * que ademas se archive seguiria siendo un logro.
 *
 * --- Por que `closingMovementId` ---
 *
 * Completar un sobre RETIRA su saldo (ver `completeEnvelope`): el
 * dinero apartado para un viaje ya hecho no puede seguir contando como
 * apartado. Ese retiro es una fila mas de `envelope_movements`, y para
 * poder DESHACER la operacion hay que saber exactamente cual es. Sin
 * este puntero habria que adivinarla por fecha o por una nota
 * centinela, y las dos formas se rompen en cuanto el usuario crea un
 * retiro parecido a mano.
 *
 * Es un `INTEGER` pelado, sin `REFERENCES envelope_movements(id)`, por
 * dos razones: `ALTER TABLE ADD COLUMN` con clave ajena y las claves
 * activadas obliga a un `DEFAULT NULL` y complica el runner sin
 * necesidad, y una clave ajena real forzaria un orden concreto al
 * deshacer (limpiar la columna ANTES de borrar la fila). Nada mas en el
 * proyecto borra filas de `envelope_movements` —no existe un
 * `deleteEnvelopeMovement`—, asi que el unico camino por el que este
 * puntero puede quedar colgando es `reopenEnvelope`, que limpia las dos
 * cosas en la misma transaccion.
 *
 * El indice es parcial, igual que `idx_envelopes_active`: solo indexa
 * las filas cumplidas, que son las pocas que la pantalla de Logros
 * consulta, en vez de una tabla entera casi toda a NULL.
 */
export const migration008Statements: string[] = [
  'ALTER TABLE envelopes ADD COLUMN completedAt TEXT',
  'ALTER TABLE envelopes ADD COLUMN closingMovementId INTEGER',
  `CREATE INDEX IF NOT EXISTS idx_envelopes_completed
     ON envelopes(completedAt DESC)
     WHERE completedAt IS NOT NULL`,
];

export default migration008Statements;
