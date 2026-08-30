/**
 * True only for values safe to store in an `INTEGER` cents column: no
 * fractional part, no `NaN`/`Infinity`.
 *
 * Shared by `accountsQueries.ts` (`accounts.initialBalance`) and
 * `financesQueries.ts` (`finances.amount`) so both money columns in this
 * schema validate identically instead of via two copies of the same
 * predicate that can silently drift apart.
 */
export const isFiniteInteger = (value: number): boolean =>
  Number.isInteger(value) && Number.isFinite(value);
