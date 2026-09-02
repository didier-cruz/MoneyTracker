/**
 * Money helpers shared by every screen that touches `@db/queries`' cents
 * amounts. Every function here works exclusively with integers — no
 * float ever represents money, matching the DB layer's own convention
 * (see `src/db/queries/financesQueries.ts` and
 * `src/hooks/useFormScreen.ts`'s original `parseAmountToCents` doc for
 * why: binary floating point cannot represent most decimal fractions
 * exactly, so `dollars * 100` silently corrupts cents at the edges).
 */

/**
 * Parses a `decimal-pad` string into an integer number of cents WITHOUT
 * going through float multiplication, by splitting the string into an
 * integer part and a (rounded) fractional part and doing the "round to
 * 2 decimals" step with string/integer arithmetic. Returns `null` for
 * anything that isn't a valid, non-negative decimal amount (never
 * throws) — negative amounts are never representable here on purpose:
 * this keyboard/regex has no `-` sign, by design (see call sites for
 * why: a transaction amount is always a magnitude, and an account's
 * initial balance is typed the same way).
 */
const parseDecimalStringToCents = (
  raw: string,
  {allowNegative = false}: {allowNegative?: boolean} = {},
): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  // `decimal-pad` can produce either separator depending on locale/keyboard.
  let normalized = trimmed.replace(',', '.');

  // El signo se separa antes de validar el resto: asi la expresion
  // regular sigue describiendo solo el numero, y un `-` en un campo que
  // no admite negativos se rechaza igual que cualquier otro caracter
  // invalido en vez de colarse.
  let isNegative = false;
  if (normalized.startsWith('-')) {
    if (!allowNegative) {
      return null;
    }
    isNegative = true;
    normalized = normalized.slice(1).trim();
  }

  if (normalized.startsWith('.')) {
    normalized = `0${normalized}`;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [integerPart, fractionPart = ''] = normalized.split('.');

  // Keep the first two fractional digits as-is, and decide whether to
  // round them up using only the third digit as a plain integer
  // comparison — no float ever touches the amount.
  const keptFraction =
    fractionPart.length >= 2
      ? fractionPart.slice(0, 2)
      : fractionPart.padEnd(2, '0');
  const roundingDigit =
    fractionPart.length > 2 ? Number(fractionPart.charAt(2)) : 0;

  let cents = parseInt(integerPart, 10) * 100 + parseInt(keptFraction, 10);
  if (roundingDigit >= 5) {
    cents += 1;
  }

  if (!Number.isSafeInteger(cents)) {
    return null;
  }

  return isNegative ? -cents : cents;
};

/**
 * Converts a `decimal-pad` amount string into an integer number of
 * cents for `insertFinance`, which requires a strictly positive
 * magnitude. Returns `null` for empty input, invalid input, or an
 * amount that parses to zero.
 */
export const parseAmountToCents = (raw: string): number | null => {
  const cents = parseDecimalStringToCents(raw);
  if (cents === null || cents <= 0) {
    return null;
  }
  return cents;
};

/**
 * Converts a `decimal-pad` amount string into an integer number of
 * cents for `insertAccount`'s optional `initialBalance`. Unlike
 * `parseAmountToCents`, an empty field is valid here (defaults to `0`,
 * the same default `insertAccount` itself applies) and a typed `0` is
 * valid too — "start this account at $0.00" is a normal, common case,
 * not an error. Still returns `null` for genuinely invalid text.
 *
 * `allowNegative` lo activan las cuentas de tipo prestamo y tarjeta de
 * credito, donde el saldo NORMAL es negativo porque representa una
 * deuda. Para las demas sigue rechazando el signo: una cuenta de
 * efectivo o un banco en negativo casi siempre es un error de tecleo, y
 * dejarlo pasar en silencio falsea el patrimonio neto sin avisar.
 */
export const parseInitialBalanceToCents = (
  raw: string,
  {allowNegative = false}: {allowNegative?: boolean} = {},
): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return 0;
  }
  return parseDecimalStringToCents(trimmed, {allowNegative});
};

/**
 * Formats a SIGNED integer number of cents as a USD-style currency
 * string, e.g. `1234` -> `"$12.34"`, `-500` -> `"-$5.00"`, `0` ->
 * `"$0.00"`. Never touches floating point: the cents remainder is
 * derived with integer `%`/`/`, and `toLocaleString` is only ever
 * called on the (already-integer) dollar part to add thousands
 * separators — a purely cosmetic step that degrades gracefully (no
 * separators, not a crash) on a Hermes build without full ICU data.
 */
export const formatCentsToCurrency = (cents: number): string => {
  const sign = cents < 0 ? '-' : '';
  const absoluteCents = Math.abs(cents);
  const dollars = Math.floor(absoluteCents / 100);
  const remainderCents = absoluteCents % 100;
  const formattedDollars = dollars.toLocaleString('en-US');
  const formattedCents = remainderCents.toString().padStart(2, '0');
  return `${sign}$${formattedDollars}.${formattedCents}`;
};
