import {IEnvelopeWithBalance} from '@db/queries';
import {accent, colors, gray, primary, secondary} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {formatMonthNameCapitalized} from '@utils/dateFormat';
import {IChartSectorInput} from '@components/organisms/Charts/DonutChart';
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
 * This calendar month's full name, capitalized, no year — e.g.
 * `"Agosto"` — for this screen's two-line header ("Analítica" /
 * `<month>`, per the approved prototype). A local, minimal duplicate of
 * `ResumenScreen/mappers.ts`'s own `getCurrentPeriod` (`'YYYY-MM'` for
 * "now"), not an import from it: that file is a SIBLING screen's own
 * module, out of this slice's scope to depend on (see this screen's
 * HANDOFF), and this is the only place Analítica needs "what period is
 * it right now" at all.
 */
export const getCurrentMonthLabel = (now: Date = new Date()): string => {
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return formatMonthNameCapitalized(`${year}-${month}`);
};

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
export const buildDebtsInsight = (sectors: IChartSectorInput[], total: number): string => {
  const biggest = sectors[0];
  if (sectors.length === 1) {
    return i18n.t('analysis.debtsInsight.oneOpenDebt', {
      name: biggest.label,
      amount: formatCentsToCurrency(biggest.value),
    });
  }
  const pct = Math.round((biggest.value / total) * 100);
  return i18n.t('analysis.debtsInsight.biggestDebt', {
    name: biggest.label,
    pct,
    total: formatCentsToCurrency(total),
  });
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
