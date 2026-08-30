import {ICategoryBudgetWithSpent, IEnvelopeWithBalance} from '@db/queries';
import {colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {formatMonthYearLong} from '@utils/dateFormat';
import i18n from '@i18n';

/** The current calendar month as `'YYYY-MM'` — what every
 * `budgetsQueries`/`envelopesQueries` `period` param expects. */
export const getCurrentPeriod = (now: Date = new Date()): string => {
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

/** `'2026-08'` -> `'August 2026'` (en) / `'agosto de 2026'` (es) — the
 * header's second line. Locale-aware, see `@utils/dateFormat`'s doc. */
export const getMonthLabel = (period: string): string => formatMonthYearLong(period);

/**
 * Strips `formatCentsToCurrency`'s display decoration ("$", thousands
 * commas) so its output can seed an editable `decimal-pad` field that
 * `parseAmountToCents` later re-parses on save — same trick
 * `useAccountForm`/`useEnvelopeForm` each already do locally (see
 * `useEnvelopeForm.ts`'s own copy for why it isn't imported from
 * there instead); shared here because BOTH `AssignWithdrawModal`
 * (implicitly, via its own fresh-blank-field reset) and
 * `CategoryLimitModal`'s edit-mode prefill need the identical
 * cents -> editable-text conversion, and unlike the two form hooks,
 * both of those already live under this same file's scope.
 */
export const centsToEditableAmountText = (cents: number): string =>
  formatCentsToCurrency(Math.abs(cents)).replace(/[$,]/g, '');

export interface IEnvelopeProgress {
  /** `false` for a `fund` with no `targetAmount` set — nothing to show
   * a bar against, see `EnvelopeCard`. */
  hasProgress: boolean;
  /** `0..1+`, never clamped here — `ProgressBar` clamps its own fill,
   * this raw ratio is also used to decide the "goal reached"/"paid
   * off" wording below. */
  ratio: number;
  /** "60% of $2,000" (fund) / "36% paid · $1,200 left" (debt) / "Paid
   * off" / "$50 saved · no goal set" — see this function's body for
   * every case. Translated via i18next (`i18n.t`, not `useTranslation`
   * — this is a plain mapper function, not a component). */
  contextLine: string;
}

/**
 * Derives the progress bar/context line for one envelope card.
 *
 * Deliberately reads a DIFFERENT numerator per `kind` — a `fund`
 * progresses by its current `balance` (money apartado so far, toward
 * `targetAmount`, its savings goal); a `debt` progresses by
 * `paidAmount` (money actually paid off so far, toward `targetAmount`,
 * the original amount owed) — see `envelopesQueries.ts`'s doc on why
 * `balance`/`paidAmount` are NOT the same number for a debt envelope.
 * Painting both kinds off `balance` alone would show a debt "getting
 * more done" merely by having money apartado and unspent, which is
 * backwards: apartar toward a debt is only the FIRST half of paying it
 * off, the withdrawal (`withdrawFromEnvelope`) is the part that
 * actually counts as progress.
 */
export const getEnvelopeProgress = (
  envelope: IEnvelopeWithBalance,
): IEnvelopeProgress => {
  if (envelope.kind === 'debt') {
    // `targetAmount`/`paidAmount`/`remainingDebt` are never `null` for a
    // `debt` row (DB `CHECK` + `ENVELOPES_WITH_BALANCE_SELECT` — see
    // `envelopesQueries.ts`) — the `?? 0`/`?? 1` fallbacks below only
    // guard the type, they are not expected to ever fire.
    const target = envelope.targetAmount ?? 1;
    const paid = envelope.paidAmount ?? 0;
    const remaining = envelope.remainingDebt ?? target;
    const ratio = target > 0 ? paid / target : 0;
    const pct = Math.round(Math.max(0, ratio) * 100);

    let contextLine: string;
    if (remaining > 0) {
      contextLine = i18n.t('budgets.progress.paidLeft', {
        pct,
        amount: formatCentsToCurrency(remaining),
      });
    } else if (remaining === 0) {
      contextLine = i18n.t('budgets.progress.paidOff');
    } else {
      contextLine = i18n.t('budgets.progress.paidOffOverpaid', {
        amount: formatCentsToCurrency(Math.abs(remaining)),
      });
    }

    return {hasProgress: true, ratio, contextLine};
  }

  // `fund`
  if (envelope.targetAmount === null) {
    return {
      hasProgress: false,
      ratio: 0,
      contextLine: i18n.t('budgets.progress.savedNoGoal', {
        amount: formatCentsToCurrency(envelope.balance),
      }),
    };
  }

  const ratio = envelope.targetAmount > 0 ? envelope.balance / envelope.targetAmount : 0;
  const pct = Math.round(Math.max(0, ratio) * 100);
  return {
    hasProgress: true,
    ratio,
    contextLine: i18n.t('budgets.progress.pctOfGoal', {
      pct,
      amount: formatCentsToCurrency(envelope.targetAmount),
    }),
  };
};

export type BudgetLimitState = 'onTrack' | 'nearLimit' | 'over';

export interface ICategoryBudgetProgress {
  /** Fraction of the limit spent, `0..1+`, unclamped (see
   * `IEnvelopeProgress.ratio`'s same note). */
  ratio: number;
  state: BudgetLimitState;
  /** `ProgressBar`'s `color` prop for this row's state — always one of
   * the three tokens named in the approved design ("verde ... ámbar ...
   * rojo"), never a hardcoded hex. */
  color: string;
  /** Only set when `state === 'over'` — "You went over by $130 this
   * month.", the explicit red message the design calls for. `null`
   * otherwise (nothing to show). */
  overMessage: string | null;
}

const NEAR_LIMIT_THRESHOLD = 0.8;

/**
 * Traffic-light state for one category's monthly spend vs its limit —
 * green under 80% spent, amber from 80% up to (not including) 100%,
 * red at/over 100%. `spent`/`limitAmount` are already resolved by
 * `getCategoryBudgets` (see `budgetsQueries.ts`); this function is pure
 * presentation on top of that row, no DB access.
 */
export const getCategoryBudgetProgress = (
  budget: ICategoryBudgetWithSpent,
): ICategoryBudgetProgress => {
  const ratio = budget.limitAmount > 0 ? budget.spent / budget.limitAmount : 0;

  if (ratio >= 1) {
    const overAmount = budget.spent - budget.limitAmount;
    return {
      ratio,
      state: 'over',
      color: colors.error[0],
      overMessage: i18n.t('budgets.overBy', {amount: formatCentsToCurrency(overAmount)}),
    };
  }
  if (ratio >= NEAR_LIMIT_THRESHOLD) {
    return {ratio, state: 'nearLimit', color: colors.warning[0], overMessage: null};
  }
  return {ratio, state: 'onTrack', color: colors.success[0], overMessage: null};
};
