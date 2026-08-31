/**
 * Locale-aware date/time display helpers for `finances.dateCreated`
 * (always an ISO-8601 UTC string — see `src/db/queries/financesQueries.ts`).
 *
 * Verified on-device (Hermes, RN 0.77, Android emulator, 2026-08-30):
 * `Intl.DateTimeFormat` with an explicit `es-ES`/`en-US` locale DOES
 * produce correct localized month/weekday names on this build
 * (`new Intl.DateTimeFormat('es-ES', {month: 'long'}).format(...)` ->
 * `"agosto"`, `{weekday: 'long'}` -> `"domingo"`), so this file uses
 * `Intl` directly rather than a hand-rolled month-name table.
 *
 * NOTE for whoever touches this next: `Intl.RelativeTimeFormat` is NOT
 * available on this same Hermes build (throws `TypeError: Cannot read
 * property 'prototype' of undefined`, verified the same way) — that's
 * why relative-time strings ("3 days ago") are NOT built here; they're
 * composed with `t()`/i18next pluralization in
 * `AnalysisScreen/mappers.ts` instead.
 */
import {getAppLanguage} from '@i18n';

/** Maps this app's 2-letter `AppLanguage` to a full BCP-47 locale tag
 * for `Intl`. Kept as an explicit table (not `${lang}-XX` string
 * building) so adding a third language later is a one-line change here,
 * not a guess. */
const INTL_LOCALES: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
};

const getIntlLocale = (): string => INTL_LOCALES[getAppLanguage()] ?? 'en-US';

/** `"2026-08-29T12:00:00.000Z"` -> `"29 Aug 2026"` (en) / `"29 ago
 * 2026"` (es), in the device's local time and the app's active
 * language. */
export const formatDisplayDate = (iso: string): string => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

/**
 * `"2026-08-29T12:00:00.000Z"` -> `"12:00 PM"`, in the device's local
 * time and the app's active language. Used INSIDE a day-grouped list
 * (see `groupFinancesByDate`) where the date itself is already the
 * section header — repeating it per row would be redundant, so each
 * row shows the time instead.
 */
export const formatDisplayTime = (iso: string): string => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(getIntlLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

/** `"2026-08-29T12:00:00.000Z"` -> `"2026-08-29"`, in the device's local
 * time — used as a grouping key, never for display, so it's
 * locale-independent on purpose. */
export const toLocalDateKey = (iso: string): string => {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** `'2026-08'` -> `'August 2026'` (en) / `'agosto de 2026'` (es) — a
 * `'YYYY-MM'` period's full month name and year, for a screen header.
 * Shared by `BudgetsScreen` (period header). */
export const formatMonthYearLong = (period: string): string => {
  const [yearStr, monthStr] = period.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  return new Intl.DateTimeFormat(getIntlLocale(), {month: 'long', year: 'numeric'}).format(date);
};

/** `'2026-08'` -> `'Aug'` (en) / `'ago'` (es) — a `'YYYY-MM'` period's
 * abbreviated month name, for a chart's per-group x-axis label. Shared
 * by `ResumenScreen`'s cash-flow chart. */
export const formatMonthAbbreviation = (period: string): string => {
  const monthStr = period.split('-')[1];
  const date = new Date(2000, Number(monthStr) - 1, 1);
  return new Intl.DateTimeFormat(getIntlLocale(), {month: 'short'}).format(date);
};

/** `'2026-08'` -> `'Agosto'` (es) / `'August'` (en) — a `'YYYY-MM'`
 * period's full month name, CAPITALIZED, no year — for a screen's
 * two-line header subtitle (e.g. `AnalysisScreen`'s "Analítica" /
 * "Agosto", per the approved prototype). `Intl.DateTimeFormat`'s own
 * `month: 'long'` already returns a capitalized `"August"` in en-US,
 * but a lowercase `"agosto"` in es-ES (Spanish's own convention for
 * month names, same as this file's own top-of-file note on verified
 * `Intl` behavior) — this uppercases just the first codepoint so both
 * locales render a capitalized single-word subtitle, matching the
 * prototype exactly, without a `textTransform: 'capitalize'` on the
 * consuming `Text` (which would ALSO capitalize the language's OWN
 * "de"/"of" if `formatMonthYearLong`'s longer string were ever reused
 * here instead — not a risk this narrower, month-only helper has). */
export const formatMonthNameCapitalized = (period: string): string => {
  const monthStr = period.split('-')[1];
  const date = new Date(2000, Number(monthStr) - 1, 1);
  const monthName = new Intl.DateTimeFormat(getIntlLocale(), {month: 'long'}).format(date);
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
};
