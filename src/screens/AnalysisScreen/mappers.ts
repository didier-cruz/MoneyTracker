import {IEnvelopeWithBalance, ISpendingByCategory} from '@db/queries';
import {accent, colors, gray, primary, secondary, tertiary} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {IChartSector, IChartSectorInput} from '@components/organisms/Charts/DonutChart';
import i18n from '@i18n';

/**
 * All the presentation-only logic for `AnalysisScreen`: which color an
 * envelope's slice gets, which envelopes are even chartable, the
 * "biggest slice" catalog sentence, and the usage-timing sentence that
 * answers this slice's third user story. Nothing here touches
 * `@db/queries` — every function is pure, fed whatever
 * `useAnalysisScreen` already loaded.
 */

/**
 * Brand palette per envelope KIND, per the approved prototype: "rojo,
 * ámbar y gris" for Deudas, "lima fuerte, lima medio e índigo" for
 * Fondos — every color pulled from `@constants/colors/colors`, none
 * hand-picked. Two notes on the exact token choices:
 * - "rojo" is `colors.secondary` (`#CF0A0A`), not `colors.error`
 *   (`#BC2424`) — `secondary` is this app's existing brand red already
 *   used as the one "red" token across other screens (e.g.
 *   `EnvelopesSection`'s retry button); `error` is reserved for actual
 *   failure states, a different semantic than "this is the red slice
 *   of a chart".
 * - "índigo" has NO literal token in `colors.ts` (only
 *   `primary`/`secondary`/`tertiary`/`accent`/etc, no `indigo` key) —
 *   `colors.primary` (`#010062`, a deep navy) is this app's own closest
 *   existing brand tone to indigo and is used here rather than adding a
 *   new hex not derived from the token file, per this slice's explicit
 *   "derive from `@constants/colors/colors`" instruction. Flagged in
 *   this slice's HANDOFF in case product wants a dedicated indigo token
 *   added to the palette later.
 *
 * More than 3 envelopes of one kind CYCLE through the same 3 tones
 * (`index % palette.length`) rather than introducing a 4th/5th ad-hoc
 * color — the prototype only specifies 3 named tones per kind, and a
 * typical Sobres list is small (see `envelopesQueries.ts`'s own "this
 * table is expected to stay small" comment on `getEnvelopes`).
 */
const DEBT_PALETTE = [colors[secondary][0], colors.warning[0], colors[gray][0]];
const FUND_PALETTE = [colors[accent][2], colors[accent][1], colors[primary][0]];

/**
 * One envelope -> one chart sector input, sorted BIGGEST value first
 * (ties broken by name, for a deterministic legend order) — matches
 * how `buildDebtsInsight`/`buildFundsInsight` below identify "the
 * biggest one" (`sectors[0]` after this sort). Envelopes whose derived
 * value is `<= 0` are EXCLUDED entirely (a paid-off debt has nothing
 * left to catalog as "remaining"; a fund with nothing assigned yet has
 * nothing to slice) — see this slice's HANDOFF for this call.
 */
const toSortedPositiveSectorInputs = (
  envelopes: IEnvelopeWithBalance[],
  getValue: (envelope: IEnvelopeWithBalance) => number,
  palette: readonly string[],
): IChartSectorInput[] =>
  envelopes
    .map(envelope => ({envelope, value: getValue(envelope)}))
    .filter(({value}) => value > 0)
    .sort((a, b) => (b.value !== a.value ? b.value - a.value : a.envelope.name.localeCompare(b.envelope.name)))
    .map(({envelope, value}, index) => ({
      id: envelope.id,
      label: envelope.name,
      value,
      color: palette[index % palette.length],
    }));

/** Debts pie slices — one per active `debt` envelope, sized by
 * `remainingDebt` (see `envelopesQueries.ts`'s doc on why this, not
 * `balance`, is the number a Debts breakdown wants). */
export const toDebtSectorInputs = (debtEnvelopes: IEnvelopeWithBalance[]): IChartSectorInput[] =>
  toSortedPositiveSectorInputs(debtEnvelopes, envelope => envelope.remainingDebt ?? 0, DEBT_PALETTE);

/** Funds pie slices — one per active `fund` envelope, sized by
 * `balance` (what's currently apartado). */
export const toFundSectorInputs = (fundEnvelopes: IEnvelopeWithBalance[]): IChartSectorInput[] =>
  toSortedPositiveSectorInputs(fundEnvelopes, envelope => envelope.balance, FUND_PALETTE);

/**
 * How much of ONE charted debt is already covered by money sitting
 * apartado in that same envelope.
 *
 * ## Why this exists at all
 *
 * The Debts ring is sized by `remainingDebt` (`targetAmount -
 * paidAmount`), and `paidAmount` only counts WITHDRAWALS — money
 * actually taken out of the envelope and applied as a payment. That is
 * the correct number for "de cuánto es cada deuda", but on its own it
 * makes the card look frozen: a user who assigns money to a debt
 * envelope every month, without having made the payment yet, sees the
 * exact same ring they saw the day they created the envelope. Their
 * progress lives in `balance` (what is apartado and unspent), which
 * the card never showed.
 *
 * The fix deliberately ADDS this as a second dimension rather than
 * re-sizing the ring by `balance`, which was considered and rejected
 * for two reasons: `toSortedPositiveSectorInputs` filters `value > 0`,
 * so a debt with nothing set aside yet would vanish from the Debts
 * chart entirely (the one debt most worth seeing); and slices sized by
 * what is apartado invert the sense of scale — a $1,500 debt with $900
 * saved would out-slice a $12,500 debt with $500 saved.
 *
 * `coveredPct` is relative to that envelope's OWN `remainingDebt`, not
 * to the chart total, so it reads as "this debt is 60% covered" and is
 * capped at 100 (an envelope can hold more apartado than it still
 * owes; the bar tops out rather than overflowing its track).
 */
export interface ISectorCoverage {
  id: number;
  /** Cents apartado in this envelope (`balance`), never negative — an
   * overdrawn envelope reads as 0 covered, not as a negative bar. */
  setAside: number;
  /** Whole number, `0..100`. */
  coveredPct: number;
}

/**
 * Coverage for every debt envelope that `toDebtSectorInputs` actually
 * charts, keyed by envelope id so `Legend` can look a row up in O(1)
 * without depending on array order. Envelopes excluded from the ring
 * (`remainingDebt <= 0`) are excluded here too, so the two can never
 * disagree about which envelopes are on screen.
 */
export const toDebtCoverageById = (
  debtEnvelopes: IEnvelopeWithBalance[],
): Record<number, ISectorCoverage> =>
  debtEnvelopes.reduce<Record<number, ISectorCoverage>>((coverage, envelope) => {
    const remaining = envelope.remainingDebt ?? 0;
    if (remaining <= 0) {
      return coverage;
    }
    const setAside = Math.max(0, envelope.balance);
    coverage[envelope.id] = {
      id: envelope.id,
      setAside,
      coveredPct: Math.min(100, Math.round((setAside / remaining) * 100)),
    };
    return coverage;
  }, {});

/**
 * Total cents apartado across the debt envelopes THE RING DRAWS — the
 * same `remainingDebt > 0` filter as above, so "of the $14,000 the ring
 * shows, $1,400 is already set aside" is always a statement about the
 * same set of envelopes.
 */
export const sumDebtSetAside = (debtEnvelopes: IEnvelopeWithBalance[]): number =>
  debtEnvelopes.reduce(
    (sum, envelope) =>
      (envelope.remainingDebt ?? 0) > 0 ? sum + Math.max(0, envelope.balance) : sum,
    0,
  );

/**
 * `"2026-08-29T12:00:00.000Z"` -> `"3 days ago"` / `"2 hours ago"` /
 * `"yesterday"` / `"just now"`, translated. NOT built on
 * `Intl.RelativeTimeFormat` — verified on-device (Hermes, RN 0.77,
 * Android emulator, 2026-08-30) that it throws (`Cannot read property
 * 'prototype' of undefined`) on this build, unlike
 * `Intl.DateTimeFormat`/`Intl.PluralRules`, which both work (see
 * `@utils/dateFormat.ts`'s doc). So the wording lives in the JSON
 * locales instead, using i18next's `_one`/`_other` plural suffixes for
 * every bucket that has a count.
 */
export const formatRelativeTime = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return i18n.t('analysis.relativeTime.justNow');
  }
  if (diffMinutes < 60) {
    return i18n.t('analysis.relativeTime.minutesAgo', {count: diffMinutes});
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return i18n.t('analysis.relativeTime.hoursAgo', {count: diffHours});
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return i18n.t('analysis.relativeTime.yesterday');
  }
  if (diffDays < 30) {
    return i18n.t('analysis.relativeTime.daysAgo', {count: diffDays});
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return i18n.t('analysis.relativeTime.monthsAgo', {count: diffMonths});
  }
  const diffYears = Math.floor(diffMonths / 12);
  return i18n.t('analysis.relativeTime.yearsAgo', {count: diffYears});
};

/** One fund envelope's most recent WITHDRAWAL (a negative
 * `envelope_movements.amount` row) — see `useAnalysisScreen.ts`'s
 * `findMostRecentFundWithdrawal` for how this is resolved from
 * `getEnvelopeMovements`. `null` when no fund envelope has any
 * withdrawal in the recent window that function scans. */
export interface ILastFundWithdrawal {
  envelopeName: string;
  /** Magnitude, cents (`Math.abs` of the underlying signed movement). */
  amount: number;
  dateCreated: string;
}

/**
 * The Debts card's one-line "reading" — a catalog insight (this
 * slice's FIRST user story: "para catalogarlas"), naming the single
 * biggest open debt and what share of the total it represents. Never
 * called with an empty `sectors` array (that's the card's empty state
 * instead, see `AnalysisPieCard`).
 */
export const buildDebtsInsight = (
  sectors: IChartSectorInput[],
  total: number,
  setAsideTotal: number = 0,
): string => {
  const biggest = sectors[0];
  const catalog =
    sectors.length === 1
      ? i18n.t('analysis.debtsInsight.oneOpenDebt', {
          name: biggest.label,
          amount: formatCentsToCurrency(biggest.value),
        })
      : i18n.t('analysis.debtsInsight.biggestDebt', {
          name: biggest.label,
          pct: Math.round((biggest.value / total) * 100),
          total: formatCentsToCurrency(total),
        });

  // Nothing apartado yet -> the catalog sentence alone, unchanged. The
  // second sentence is not "you have $0 set aside" (a scold with no
  // action in it), it only appears once there is real progress to
  // report.
  if (setAsideTotal <= 0) {
    return catalog;
  }

  // Floored at 0 rather than allowed negative: holding MORE apartado
  // than the ring's remaining debt is a good problem, and "te faltan
  // -$300" is not a sentence.
  const stillNeeded = Math.max(0, total - setAsideTotal);
  return `${catalog} ${i18n.t('analysis.debtsInsight.stillNeeded', {
    setAside: formatCentsToCurrency(setAsideTotal),
    stillNeeded: formatCentsToCurrency(stillNeeded),
  })}`;
};

/**
 * The Funds card's one-line "reading" — dedicated ENTIRELY to usage
 * timing (this slice's THIRD user story: "estar consciente de cuándo
 * lo utilizo"), not a repeat of the chart/legend's own composition
 * numbers (those already answer the SECOND story on their own). This
 * is this slice's resolution for "emergency fund" / "safety fund"
 * specifically: this app's envelope schema has no dedicated concept
 * for either (they are ordinary `fund` envelopes the user names
 * themselves) — see this slice's HANDOFF for the full reasoning — so
 * instead of inventing a name-matching heuristic (fragile: matches only
 * if the user typed "Emergency"/"Safety" a particular way), this single
 * sentence surfaces the most recent withdrawal across EVERY fund
 * envelope, whatever it's named, which is the same information an
 * emergency/safety fund's own withdrawal history would show, without
 * requiring the schema to know which fund is "the emergency one".
 */
export const buildFundsInsight = (lastWithdrawal: ILastFundWithdrawal | null): string => {
  if (!lastWithdrawal) {
    return i18n.t('analysis.fundsInsight.untouched');
  }
  return i18n.t('analysis.fundsInsight.lastUsed', {
    when: formatRelativeTime(lastWithdrawal.dateCreated),
    amount: formatCentsToCurrency(lastWithdrawal.amount),
    name: lastWithdrawal.envelopeName,
  });
};

/* ------------------------------------------------------------------ *
 *  "En que gastas" — gasto por categoria en el periodo seleccionado.
 * ------------------------------------------------------------------ */

/**
 * Cinco tonos para las categorias, todos tokens de
 * `@constants/colors/colors` — misma regla que `DEBT_PALETTE`/
 * `FUND_PALETTE`: ningun hex elegido a ojo.
 *
 * `secondary` (`#CF0A0A`) queda FUERA a proposito. En esta app el rojo
 * ya significa deuda y saldo negativo (`AccountCard`, `DEBT_PALETTE`,
 * los importes en `error[0]`); gastarlo en "la cuarta categoria que
 * salio en la consulta" lo vuelve decorativo y le quita el significado
 * que si tiene en las otras dos tarjetas de esta misma pantalla.
 */
const EXPENSE_PALETTE = [
  colors[primary][0],
  colors[accent][2],
  colors[tertiary][0],
  colors.info[1],
  colors.warning[0],
];

/**
 * Cuantas categorias se dibujan con su propio color antes de que el
 * resto caiga en "Otros". Cinco es el largo de `EXPENSE_PALETTE`, y no
 * por casualidad: pasar de ahi obligaria a ciclar la paleta
 * (`index % length`, como hacen los sobres) y dos sectores del MISMO
 * anillo compartirian color, que en una leyenda es indistinguible de
 * un error. Los sobres pueden permitirselo porque una lista de sobres
 * es corta; aqui hay 19 categorias de gasto sembradas de fabrica.
 */
const MAX_EXPENSE_SECTORS = 5;

/**
 * El id del sector agregado. Negativo a proposito: `categories.id` es
 * un `INTEGER PRIMARY KEY AUTOINCREMENT`, siempre `>= 1`, asi que este
 * valor no puede chocar con una categoria real ni hoy ni nunca — lo
 * que importa porque `Legend` y `DonutChart` indexan por `id`.
 */
export const OTHERS_SECTOR_ID = -1;

export interface IExpenseChartData {
  /** Listos para `buildDonutData`, de mayor a menor, con "Otros" —si
   * existe— SIEMPRE al final. */
  sectors: IChartSectorInput[];
  /** Icono por `id` de sector, para la leyenda. */
  iconById: Record<number, string>;
}

/**
 * Gasto por categoria -> sectores del dónut, quedandose con las
 * `MAX_EXPENSE_SECTORS` mas grandes y sumando TODO el resto en un unico
 * sector gris "Otros (N)".
 *
 * El agregado lleva el conteo en la etiqueta por una razon concreta:
 * sin el, "Otros" se lee como una categoria mas —el usuario puede
 * incluso tener una llamada asi— y no como una suma. Con "(4)" queda
 * claro que detras hay cuatro cosas que no cupieron.
 *
 * `spent` ya viene `>= 0` y ordenado de mayor a menor desde
 * `getSpendingByCategory`; aun asi se filtra `> 0` porque
 * `buildDonutData` no sabe dibujar un sector de tamano cero y una
 * categoria con gasto neto cero (un gasto y su reembolso en el mismo
 * tramo) es perfectamente posible.
 */
export const toExpenseChartData = (rows: ISpendingByCategory[]): IExpenseChartData => {
  const positive = rows.filter(row => row.spent > 0);
  const top = positive.slice(0, MAX_EXPENSE_SECTORS);
  const rest = positive.slice(MAX_EXPENSE_SECTORS);

  const sectors: IChartSectorInput[] = top.map((row, index) => ({
    id: row.category.id,
    label: row.category.name,
    value: row.spent,
    color: EXPENSE_PALETTE[index],
  }));
  const iconById: Record<number, string> = Object.fromEntries(
    top.map(row => [row.category.id, row.category.icon]),
  );

  if (rest.length > 0) {
    sectors.push({
      id: OTHERS_SECTOR_ID,
      label: String(i18n.t('analysis.othersLabel', {count: rest.length})),
      value: rest.reduce((sum, row) => sum + row.spent, 0),
      color: colors[gray][0],
    });
    iconById[OTHERS_SECTOR_ID] = 'ellipsis-h';
  }

  return {sectors, iconById};
};

/**
 * Icono por id para las tarjetas de sobres. Trivial, pero existe para
 * que `AnalysisScreen` no arme el mismo `Object.fromEntries` tres veces
 * en linea dentro del JSX.
 */
export const toEnvelopeIconById = (
  envelopes: IEnvelopeWithBalance[],
): Record<number, string> =>
  Object.fromEntries(envelopes.map(envelope => [envelope.id, envelope.icon]));

/**
 * La frase de la tira lima bajo el dónut de gastos.
 *
 * Dos casos, y el segundo importa tanto como el primero: cuando ninguna
 * categoria domina, decir "X se llevo el 18%" no informa de nada —lo
 * util ahi es justamente que el gasto esta repartido—, asi que la frase
 * cambia de forma en lugar de repetir la plantilla con un numero
 * pequeno. El corte esta en 30%: por debajo de eso la categoria mas
 * grande no manda sobre el total.
 *
 * Devuelve `null` sin sectores; la tarjeta ya muestra su vacio.
 */
export const buildExpenseInsight = (sectors: IChartSector[]): string | null => {
  const [biggest] = sectors;
  if (biggest === undefined) {
    return null;
  }
  if (biggest.percentage < 30) {
    return String(i18n.t('analysis.expensesInsight.spread', {pct: biggest.percentage}));
  }
  return String(
    i18n.t('analysis.expensesInsight.dominant', {
      category: biggest.label,
      pct: biggest.percentage,
    }),
  );
};
