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
 * Converts a `'YYYY-MM'` period into the half-open ISO-8601 UTC range
 * `[start, end)` that range-filters `finances.dateCreated`/
 * `envelope_movements.dateCreated` correctly: `start` is the period's
 * first instant, `end` is the FOLLOWING month's first instant (exclusive
 * upper bound — a plain string `<` comparison against `dateCreated`
 * therefore never needs to know how many days are in the month, and
 * never includes a stray last-instant-of-month row twice).
 *
 * Throws `Error('Invalid period: ...')` for a malformed input — callers
 * are expected to have already validated with `isValidPeriod` (or be
 * passing a period straight from a validated `category_budgets` row),
 * this is a defensive backstop, not the primary validation point.
 */
export const periodToRange = (period: string): {start: string; end: string} => {
  if (!isValidPeriod(period)) {
    throw new Error(`Invalid period: ${period}`);
  }
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12

  // `Date.UTC` takes a 0-based month; passing `month` (1-12) as the
  // MONTH ARGUMENT for `end` deliberately asks for "month after this
  // one" in one step, relying on `Date.UTC`'s own overflow handling
  // (month 12 for a `'YYYY-12'` period correctly rolls into `YYYY+1-01`).
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  return {start, end};
};
