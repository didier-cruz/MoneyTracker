/**
 * `'YYYY-MM'` calendar-month period helpers, shared by `budgetsQueries.ts`
 * (a category budget's `period` column, see
 * `src/db/migrations/005_envelopesAndCategoryBudgets.ts`) and
 * `analyticsQueries.ts` (the dashboard's month-range filters), so both
 * validate/convert the same string shape identically instead of two
 * copies of the same regex/date-math drifting apart.
 */

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True only for a well-formed `'YYYY-MM'` string with a real month
 * (`01`-`12`). Does not validate the year is "reasonable" — any 4-digit
 * year is accepted, same permissiveness `dateCreated` (a plain ISO-8601
 * string, never range-checked) already has elsewhere in this schema. */
export const isValidPeriod = (period: string): boolean => PERIOD_PATTERN.test(period);

/**
 * Convierte un periodo `'YYYY-MM'` en el rango semiabierto `[start, end)`
 * —en ISO-8601 UTC— que filtra `finances.dateCreated` /
 * `envelope_movements.dateCreated`: `start` es el primer instante del
 * periodo y `end` el primer instante del mes SIGUIENTE (cota superior
 * exclusiva, asi una comparacion de cadenas `<` nunca necesita saber
 * cuantos dias tiene el mes ni incluye dos veces el ultimo instante).
 *
 * ## Los limites son la medianoche LOCAL, no la UTC
 *
 * Antes se construian con `Date.UTC(...)`, y eso partia el mes por la
 * medianoche de Greenwich. Consecuencia medida en el emulador con el
 * reloj en UTC-6: un gasto registrado el 31 de agosto a las 18:08 se
 * guarda como `2026-09-01T00:08Z`, la lista de movimientos lo mostraba
 * bajo "31 ago" —agrupa por fecha local— y en cambio contaba contra el
 * limite de SEPTIEMBRE y subia los "Gastos de este mes" de septiembre.
 * El mismo movimiento en dos meses distintos segun la pantalla, sin
 * ningun error visible. En un huso UTC-6 eso afecta a las ultimas seis
 * horas de cada dia: la cuarta parte del tiempo.
 *
 * `new Date(year, month - 1, 1)` interpreta los componentes en la hora
 * LOCAL del dispositivo y `toISOString()` los convierte al instante UTC
 * equivalente. Asi el rango de septiembre para un usuario en UTC-6 va de
 * `2026-09-01T06:00Z` a `2026-10-01T06:00Z`: exactamente el mes que esa
 * persona ve en su calendario.
 *
 * Esta es ademas la convencion que la app YA usaba en la otra mitad —
 * `AllMovementsScreen/mappers.ts` construye sus ventanas con
 * `new Date(y, m, 1).toISOString()` desde que se escribio—, asi que esto
 * no introduce un criterio nuevo: unifica en el que ya coincidia con lo
 * que se muestra.
 *
 * Lo que NO cubre: el desfase se resuelve por fecha, asi que un cambio
 * de horario de verano dentro del mes se maneja bien aqui (cada limite
 * usa el desfase vigente ese dia), pero ver `getCashFlowByMonth` para el
 * caso del agrupado, que si asume un desfase fijo.
 *
 * Lanza `Error('Invalid period: ...')` si el formato no es valido — los
 * llamadores ya deberian haber validado con `isValidPeriod`, esto es una
 * red de seguridad, no el punto principal de validacion.
 */
export const periodToRange = (period: string): {start: string; end: string} => {
  if (!isValidPeriod(period)) {
    throw new Error(`Invalid period: ${period}`);
  }
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12

  // El constructor toma el mes en base 0; pasar `month` (1-12) como
  // ARGUMENTO DE MES para `end` pide "el mes siguiente" en un solo paso,
  // apoyandose en el desbordamiento que el propio `Date` maneja (el mes
  // 12 de un periodo `'YYYY-12'` rueda correctamente a `YYYY+1-01`).
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();
  return {start, end};
};

/**
 * Modificador de `datetime()` de SQLite que lleva un instante UTC a la
 * hora LOCAL del dispositivo — p. ej. `'-360 minutes'` en UTC-6.
 *
 * `getTimezoneOffset()` devuelve los minutos que hay que SUMAR a la hora
 * local para obtener UTC (360 en UTC-6), asi que para el viaje inverso
 * se niega el signo.
 *
 * Se calcula al llamar, no al cargar el modulo: si se congelara, un
 * dispositivo que cruza husos —o que entra en horario de verano con la
 * app abierta— seguiria agrupando con el desfase viejo.
 *
 * LIMITE CONOCIDO: es un desfase FIJO aplicado a todo el rango, asi que
 * en paises con horario de verano los movimientos del lado opuesto del
 * cambio se agrupan con una hora de error. Puede desplazar de mes a un
 * movimiento de la primera o ultima hora del mes, y solo en el mes del
 * cambio. Es un error muy inferior al que se corrige aqui —seis horas,
 * todos los dias— y quitarlo del todo exigiria guardar la fecha local
 * al registrar, que es la opcion C que se descarto por su coste.
 */
export const getLocalTimeModifier = (): string =>
  `${-new Date().getTimezoneOffset()} minutes`;
