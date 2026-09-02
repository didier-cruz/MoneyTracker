/**
 * Migration `user_version` 6.
 *
 * Dos cambios que van juntos porque sirven al mismo caso: registrar un
 * financiamiento con intereses (un extrafinanciamiento, un prestamo
 * personal, una hipoteca).
 *
 * 1. Anade `'loan'` a los tipos de cuenta permitidos.
 * 2. Siembra una categoria de GASTO "Interests".
 *
 * --- 1. Por que hace falta reconstruir `accounts` ---
 *
 * `kind` lleva `CHECK (kind IN ('cash','bank','credit_card',
 * 'receivable'))` desde la migracion 4, y SQLite no permite alterar una
 * restriccion `CHECK`: la unica via es el baile de recrear la tabla,
 * copiar, borrar y renombrar. Es la tercera vez que este proyecto lo
 * hace (migraciones 2 y 4), pero la primera sobre una tabla a la que
 * OTRA apunta con una clave ajena (`finances.idAccount`), asi que:
 *
 * - Las claves ajenas van desactivadas mientras dura, via el flag
 *   `requiresForeignKeysOff` del runner. Sin eso, `DROP TABLE accounts`
 *   fallaria por las filas de `finances` que la referencian.
 * - Renombrar `accounts_v2` a `accounts` NO reescribe la clausula
 *   `REFERENCES accounts(id)` de `finances`, porque nadie referencia a
 *   `accounts_v2`: la referencia de `finances` sigue apuntando al nombre
 *   `accounts`, que tras el renombrado resuelve a la tabla nueva. Es
 *   justo el caso en que el renombrado NO toca otras tablas.
 * - El indice `idx_accounts_active` se va con la tabla vieja al
 *   borrarla, asi que se vuelve a crear al final. Un indice no
 *   sobrevive al `DROP` de su tabla.
 *
 * Por que `'loan'` y no reutilizar `'credit_card'`: una tarjeta y un
 * prestamo se parecen en que ambos llevan saldo negativo, pero no son lo
 * mismo. Un prestamo tiene capital, plazo y cuota; una tarjeta es una
 * linea revolvente. Meterlos en el mismo tipo obliga a que cualquier
 * regla futura sobre uno afecte al otro, y ya hoy hace que la pantalla
 * de cuentas mienta sobre lo que es cada cosa.
 *
 * --- 2. Por que una categoria de interes de GASTO ---
 *
 * La migracion 3 sembro "Interests" como categoria de INGRESO: intereses
 * que se ganan. No existia la contraria. Sin ella, la cuota de un
 * prestamo se registra entera bajo "Loan", mezclando amortizacion de
 * capital con coste financiero en la misma bolsa — y entonces Analisis
 * no puede responder "cuanto me costo este financiamiento", que es la
 * unica pregunta que justifica registrar el interes por separado.
 *
 * El nombre va en INGLES como los otros 11 por coherencia con la
 * migracion 3: los nombres de categoria son datos del usuario, no
 * cadenas traducibles, y mezclar idiomas en la siembra dejaria una lista
 * a medias.
 *
 * La siembra esta guardada por nombre+tipo en vez de por si la tabla
 * esta vacia (el guarda que uso la migracion 3): aqui la tabla NUNCA
 * esta vacia y lo que hay que evitar es duplicar esta fila concreta.
 * Asi el reintento tras un fallo tampoco la duplica.
 */
export const migration006Statements: string[] = [
  // 1. accounts, con 'loan' entre los tipos validos.
  `CREATE TABLE accounts_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('cash', 'bank', 'credit_card', 'receivable', 'loan')),
    initialBalance INTEGER NOT NULL DEFAULT 0,
    archivedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `INSERT INTO accounts_v2 (id, name, icon, kind, initialBalance, archivedAt, createdAt, updatedAt)
    SELECT id, name, icon, kind, initialBalance, archivedAt, createdAt, updatedAt FROM accounts;`,
  `DROP TABLE accounts;`,
  `ALTER TABLE accounts_v2 RENAME TO accounts;`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(archivedAt) WHERE archivedAt IS NULL;`,

  // 2. Categoria de gasto para el interes pagado. El literal de fecha es
  // la fecha de envio de esta migracion, un hecho historico fijo, no un
  // `new Date()` — mismo motivo que documenta la migracion 3.
  `INSERT INTO categories (category, icon, type)
    SELECT 'Interests', 'percent', 'expense'
    WHERE NOT EXISTS (
      SELECT 1 FROM categories WHERE category = 'Interests' AND type = 'expense'
    );`,
];
