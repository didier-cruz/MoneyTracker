# Tech debt — arquitectura

Formato: impacto + condición de disparo para retomar. No es una lista de "algún día".

## Predictive back desactivado a la fuerza (React Native 0.77)

- **Origen:** subida a `targetSdkVersion 36`, exigida por Google Play.
- **Qué pasa:** Android 16 dejó de llamar a `onBackPressed()` y de despachar
  `KEYCODE_BACK` para las apps que apuntan a 36. React Native 0.77 todavía depende de
  esos callbacks, así que su `BackHandler` —del que cuelga React Navigation— nunca se
  entera del gesto y el sistema cierra la actividad. Volver atrás desde el formulario
  sacaba de la app en vez de regresar a Balance.
- **Qué se hizo:** `android:enableOnBackInvokedCallback="false"` en el manifest, que es
  la salida que documenta el propio Android. Poner la bandera en `true` NO arregla nada
  en esta versión de RN; se probó primero y el fallo seguía igual.
- **Qué se pierde:** las animaciones de predictive back. Nada funcional.
- **Cómo se cierra:** subir a **React Native 0.81**, que reimplementa el back sobre
  `OnBackPressedDispatcher`. Al hacerlo hay que quitar esa línea del manifest y volver a
  verificar el gesto en un dispositivo con Android 16, no fiarse de que compile.
- **Disparador para retomar:** la próxima subida de versión de React Native.

## Categorías heredadas de la migración 003 sin fusión (`Food`, `Bills`, `Children`) — CERRADO

- **Origen:** ADR `0003-siembra-traducida-fusion-de-categorias-heredadas-en-codigo.md`
  (superseded by `0004-seedkey-y-traduccion-en-vivo-de-la-siembra.md`, que hereda este
  mismo ítem sin resolverlo — ver su sección "Backfill", punto 2).
- **Impacto (histórico):** toda instalación que ya corrió la migración 003 conservaba
  estas 3 categorías en inglés, sin traducir NI en vivo (sin `seedKey`, tras la migración
  009), mientras el resto de la siembra sí seguía el idioma activo.
- **Por qué no se resolvió antes:** el mapeo no era 1 a 1 sin ambigüedad — fusionar
  exigía adivinar la intención del usuario sobre datos ya existentes, exactamente el tipo
  de automatismo que este proyecto ya rechazó una vez (pitch de saldo inicial de
  tarjetas, decisión (c)).
- **Resolución final (revisión del dueño en el dispositivo, 2026-09-11):** una propuesta
  intermedia (`docs/product/pitches/depurar-categorias-heredadas-duplicadas.md`) había
  shapeado RETIRAR las seis (`House`/`Food`/`Bills`/`Children`/`Rent`/`Interests`
  ingreso) sin que el dueño la hubiera confirmado todavía. Al revisar las categorías
  directamente en su dispositivo, el dueño dio una instrucción **distinta y más
  concreta** para tres de ellas: **`Bills`→"Facturas"`, `Children`→"Hijos"`,
  `Food`→"Despensa"` se CONSERVAN,
  traducidas vía `seedKey`** — no se fusionan con ninguna categoría curada existente,
  siguen siendo conceptos propios (ver `src/data/defaultCategories.ts` para por qué
  `pantry`/Despensa es un concepto distinto de `groceries`/Supermercado). Se retiran
  `House`/`Credit card`(x2)/`Interests`(ingreso)/`Rent`/`Loan`(x2) (`retiredAt`, sin
  tocar `finances`) — siete filas. `Salary` sigue confirmada sin duplicado y
  fuera de alcance. Implementado en la migración 10
  (`src/db/migrations/010_retireLegacyCategoriesAndSeedKeys.ts`) — ver ADR 0005
  (`0005-migracion-010-retiro-y-traduccion-de-categorias-heredadas.md`), que reemplaza
  tanto la propuesta de la pitch citada como el alcance de la ADR 0002 para estas filas.
  `Children` YA NO queda "retirada sin reemplazo" — se conserva traducida, así que el
  disparador de "agregar categoría de crianza" anotado en `docs/product/roadmap.md`
  queda obsoleto y puede retirarse de ahí en el próximo pase de ese documento. Ítem
  cerrado.

## `LEGACY_INTERESTS_NAME` rename sin guarda de cardinalidad

- **Origen:** `src/db/queries/seedQueries.ts`, ya en producción (commit `6784904`).
- **Impacto:** el `UPDATE categories SET category = ? WHERE category = 'Interests'
  AND type = 'expense'` no verifica que exista exactamente una fila con ese
  nombre+tipo antes de renombrar — si un usuario hubiera creado a mano una segunda
  categoría llamada literalmente `'Interests'` de tipo `expense` antes de que este
  código corriera, ambas quedarían renombradas a `feesInterest` traducido, fusionando
  dos categorías que el usuario quería mantener separadas.
- **Por qué no se corrigió ahora:** ya corrió (o puede haber corrido) en el único
  dispositivo real que usa esta app; cambiar su comportamiento retroactivamente no
  deshace lo que ya se ejecutó, y el caso (un usuario creando a mano una categoría
  llamada exactamente `'Interests'`) es de probabilidad muy baja. El backfill de la
  migración 009 (ADR 0004) SÍ lleva guarda de cardinalidad (`COUNT(*) = 1`) en cada una
  de sus 46 sentencias, para no repetir este patrón hacia adelante; solo esta llamada
  puntual, ya en producción antes de la ADR 0004, queda sin ella.
- **Disparador para retomar:** si algún usuario reporta una categoría que "desapareció
  fusionada" sin haberlo esperado, o antes de reutilizar este mismo patrón de rename
  para una quinta categoría heredada.

## `categories.retiredAt` sin señal visual en `CategoriesAdminScreen`

- **Origen:** ADR `0002-migracion-012-retiro-categorias-tarjeta-prestamo.md` (superseded
  by `0005-migracion-010-retiro-y-traduccion-de-categorias-heredadas.md`, que hereda este
  ítem sin resolverlo).
- **Actualizado 2026-09-12:** el dueño señaló en su dispositivo que esas filas llenando
  la pantalla de Categorías ERAN el problema, no la falta de insignia. Ahora
  `CategoriesAdminScreen` y `useCategoriesScreen` pasan `hideRetiredWithoutMovements`,
  así que una retirada solo sigue visible si TODAVÍA guarda movimientos. Eso reduce este
  ítem pero no lo cierra: en ese caso restante sí hace falta la marca, porque el usuario
  ve una categoría que no puede elegir al crear un movimiento nuevo y nada se lo explica.
- **Impacto (reducido):** solo las filas retiradas que aún conservan movimientos siguen listadas en `CategoriesAdminScreen` sin ninguna marca que diga "retirada". Un
  usuario que abra esa pantalla no tiene forma de saber por qué esas filas ya no
  aparecen al crear un movimiento nuevo pero sí siguen en la lista de gestión.
- **Disparador para retomar:** próxima vez que se toque `CategoriesAdminScreen` por
  cualquier otro motivo, o si el dueño reporta confusión con estas filas.

## ~~`Loan` sigue siendo categoría Y tipo de cuenta~~ — CERRADO

- **Estado:** resuelto el 2026-09-12. Este ítem existió menos de un día.
- **Qué pasó:** la primera instrucción del dueño fue traducir `Loan` a "Préstamo" y
  conservarla, mientras retiraba `Credit card`. Se ejecutó tal cual y se anotó aquí el
  reparo: desde la migración 006 ambas son EXACTAMENTE el mismo caso — un
  `accounts.kind` (`loan`, `credit_card`) que además existe como categoría, lo que hace
  contar el mismo dinero dos veces. Al planteárselo, el dueño respondió "quita loan
  también, es el mismo error".
- **Resolución:** `Loan` se retira en sus dos tipos, igual que `Credit card`, sin
  `seedKey` — conserva su literal en la pantalla de categorías como el resto de
  retiradas. La clave `defaultCategories.loan` sale de los JSON de i18n y de
  `DEFAULT_CATEGORIES`. **`accounts.kindLabels.loan` NO se toca**: esa es la etiqueta
  del tipo de cuenta, que es justamente el concepto correcto y el que se conserva.
- **Por qué se editó la migración 010 en vez de añadir una 011:** la 010 no había salido
  de la rama ni llegado a ninguna instalación real. La regla de no tocar migraciones
  publicadas protege a los dispositivos que ya la corrieron; aquí no había ninguno salvo
  un emulador de pruebas que se borró. Añadir una migración para deshacer lo que la
  anterior acababa de hacer, sin publicar, solo habría dejado rastro arqueológico.

## `Food`→"Despensa" puede colisionar con una categoría "Despensa" creada a mano

- **Origen:** ADR `0005-migracion-010-retiro-y-traduccion-de-categorias-heredadas.md`,
  sección "El riesgo de colisión Food → Despensa".
- **Impacto:** se confirmó en `/tmp/mt-backup.db` (copia real del dueño) una categoría
  `Despensa` (`expense`, icono `shopping-cart`) creada A MANO, con movimientos y un
  presupuesto mensual reales. Si una instalación conserva ADEMÁS la fila `Food` de la
  migración 003 sin borrar, la migración 10 (y el renombrado equivalente para
  instalaciones nuevas en `seedQueries.ts`) tienen un candado explícito
  (`avoidIfNameExists`) que evita traducirla en ese caso — la fila `Food` se queda sin
  `seedKey`, sin duplicar el nombre. El candado es puntual (solo para `pantry`, por
  evidencia concreta), no un mecanismo general de detección de colisión de nombres
  traducidos contra categorías del usuario.
- **Disparador para retomar:** si aparece evidencia de una colisión equivalente para
  `bills`/`children`/`loan` (una categoría de usuario con ese nombre exacto), o si se
  decide construir un mecanismo general en vez de candados puntuales por clave.

## `accounts`/`categories`: coordinación manual de `src/db/db.ts` entre migraciones paralelas

- **Origen:** ADR `0001-migraciones-011-012-saldo-inicial-tarjetas-credito.md` (ahora
  "011-012", ver esa ADR — renumerada dos veces por este mismo motivo).
- **Impacto:** el runner de migraciones (`user_version`, array ordenado) no tiene
  ningún mecanismo de asignación de número en paralelo — cada nueva migración requiere
  coordinación humana para no colisionar. Con tres frentes simultáneos ya hizo falta una
  ADR completa solo para desambiguar el número, y la numeración final se corrió DOS
  veces: primero cuando la ADR 0004 (traducción en vivo) tomó el 009 por delante de los
  otros dos frentes, y de nuevo cuando la ADR 0005 (revisión de categorías en el
  dispositivo) tomó el 010 por delante de la ADR 0001, que seguía sin código escrito.
- **Disparador para retomar:** si el ritmo de migraciones paralelas aumenta (más de un
  frente de esquema activo a la vez de forma habitual, no solo esta vez), vale la pena
  evaluar un esquema de reserva de números (p. ej. un archivo `NEXT_MIGRATION` en el
  repo que cada rama incrementa al abrir su PR) — hoy, para cuatro migraciones ya
  renumeradas dos veces, empieza a acercarse al punto donde vale la pena, aunque
  todavía no se cruza esa línea.
