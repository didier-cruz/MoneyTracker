import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {SQLiteDatabase} from 'react-native-sqlite-storage';
import {getDbConnection} from '@db/db';
import {
  getEnvelopeMovements,
  getEnvelopes,
  getEnvelopesTotal,
  getTotalRemainingDebt,
  IEnvelopeWithBalance,
} from '@db/queries';
import {ILastFundWithdrawal} from '@screens/AnalysisScreen/mappers';

export type LoadStatus = 'loading' | 'success' | 'error';

/**
 * How many of a fund envelope's MOST RECENT movements to look at when
 * searching for its last withdrawal. This is a "recent activity" scan,
 * not a full-history one — see `findMostRecentFundWithdrawal`'s own doc
 * for why a bounded, recency-focused window is the right tradeoff for
 * an "am I aware of when I use this" feature specifically, not a
 * shortcut taken only for performance.
 */
const WITHDRAWAL_SCAN_LIMIT = 20;

/**
 * Resolves the single most recent WITHDRAWAL (a negative
 * `envelope_movements.amount` row — see `IEnvelopeMovement`'s doc)
 * across every active `fund` envelope, for the Funds card's usage-
 * timing insight (this slice's third user story). One
 * `getEnvelopeMovements` call PER fund envelope (there is no
 * `@db/queries` aggregate for "last withdrawal across all envelopes of
 * a kind" — this contract is final, not this agent's to add to), each
 * scanning only its newest `WITHDRAWAL_SCAN_LIMIT` movements (that
 * function's own newest-first order) rather than paging through an
 * envelope's entire history.
 *
 * This bound is a DELIBERATE product choice, not just an optimization:
 * "cuándo lo utilizo" is about staying aware of RECENT use, the same
 * way a bank app's "last used" badge on a card only cares about recent
 * activity, not a purchase from three years ago. If a fund's last 20
 * movements are all assignments (no withdrawal at all in that window),
 * this resolves to "no recent withdrawal" for that envelope — which
 * IS the accurate, honest answer to "have you used this lately", even
 * though an older withdrawal might exist further back in its full
 * history.
 *
 * Returns `null` immediately (no queries at all) when there are no fund
 * envelopes, and `null` if none of them has a withdrawal in their own
 * scanned window.
 */
const findMostRecentFundWithdrawal = async (
  db: SQLiteDatabase,
  fundEnvelopes: IEnvelopeWithBalance[],
): Promise<ILastFundWithdrawal | null> => {
  if (fundEnvelopes.length === 0) {
    return null;
  }

  const perEnvelopeWithdrawal = await Promise.all(
    fundEnvelopes.map(async envelope => {
      const {items} = await getEnvelopeMovements(db, envelope.id, {
        limit: WITHDRAWAL_SCAN_LIMIT,
      });
      const withdrawal = items.find(item => item.amount < 0);
      if (!withdrawal) {
        return null;
      }
      return {
        envelopeName: envelope.name,
        amount: Math.abs(withdrawal.amount),
        dateCreated: withdrawal.dateCreated,
      };
    }),
  );

  const found = perEnvelopeWithdrawal.filter(
    (candidate): candidate is ILastFundWithdrawal => candidate !== null,
  );
  if (found.length === 0) {
    return null;
  }

  return found.reduce((latest, current) =>
    current.dateCreated > latest.dateCreated ? current : latest,
  );
};

/**
 * All data-fetching for `AnalysisScreen` — two independent questions,
 * Debts and Funds, tracked with their own load/error state, same
 * "unrelated tables, unrelated questions, one failing doesn't blank the
 * other" split `useBudgetsScreen` already established for its own
 * Envelopes/Limits sections.
 *
 * Reloaded on every focus regain (`useFocusEffect`), not just on mount
 * — the user can assign/withdraw/create/archive an envelope from the
 * Budgets tab and land back here, and this screen has no other way to
 * learn that happened. First load per section shows a spinner; every
 * reload after that is silent, same reasoning as `useBudgetsScreen`.
 */
export const useAnalysisScreen = () => {
  const {t} = useTranslation();
  const [debtEnvelopes, setDebtEnvelopes] = useState<IEnvelopeWithBalance[]>([]);
  const [totalRemainingDebt, setTotalRemainingDebt] = useState(0);
  const [debtsStatus, setDebtsStatus] = useState<LoadStatus>('loading');
  const [debtsErrorMessage, setDebtsErrorMessage] = useState('');
  const hasLoadedDebtsRef = useRef(false);

  const [fundEnvelopes, setFundEnvelopes] = useState<IEnvelopeWithBalance[]>([]);
  const [totalFundsBalance, setTotalFundsBalance] = useState(0);
  const [lastFundWithdrawal, setLastFundWithdrawal] = useState<ILastFundWithdrawal | null>(null);
  const [fundsStatus, setFundsStatus] = useState<LoadStatus>('loading');
  const [fundsErrorMessage, setFundsErrorMessage] = useState('');
  const hasLoadedFundsRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDebts = useCallback(async () => {
    const silent = hasLoadedDebtsRef.current;
    if (!silent) {
      setDebtsStatus('loading');
    }
    setDebtsErrorMessage('');
    try {
      const db = await getDbConnection();
      const [envelopes, total] = await Promise.all([
        getEnvelopes(db, {kind: 'debt'}),
        getTotalRemainingDebt(db),
      ]);
      setDebtEnvelopes(envelopes);
      setTotalRemainingDebt(total);
      setDebtsStatus('success');
      hasLoadedDebtsRef.current = true;
    } catch (e: any) {
      console.warn('[useAnalysisScreen] loadDebts failed:', e?.message ?? e);
      if (!silent) {
        setDebtsErrorMessage(t('analysis.loadDebtsError', {message: e?.message ?? t('common.unknownError')}));
        setDebtsStatus('error');
      }
    }
  }, [t]);

  const loadFunds = useCallback(async () => {
    const silent = hasLoadedFundsRef.current;
    if (!silent) {
      setFundsStatus('loading');
    }
    setFundsErrorMessage('');
    try {
      const db = await getDbConnection();
      const [envelopes, total] = await Promise.all([
        getEnvelopes(db, {kind: 'fund'}),
        getEnvelopesTotal(db, {kind: 'fund'}),
      ]);
      const lastWithdrawal = await findMostRecentFundWithdrawal(db, envelopes);
      setFundEnvelopes(envelopes);
      setTotalFundsBalance(total);
      setLastFundWithdrawal(lastWithdrawal);
      setFundsStatus('success');
      hasLoadedFundsRef.current = true;
    } catch (e: any) {
      console.warn('[useAnalysisScreen] loadFunds failed:', e?.message ?? e);
      if (!silent) {
        setFundsErrorMessage(t('analysis.loadFundsError', {message: e?.message ?? t('common.unknownError')}));
        setFundsStatus('error');
      }
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadDebts();
      loadFunds();
    }, [loadDebts, loadFunds]),
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadDebts(), loadFunds()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDebts, loadFunds]);

  return {
    debtEnvelopes,
    totalRemainingDebt,
    debtsStatus,
    debtsErrorMessage,
    reloadDebts: loadDebts,

    fundEnvelopes,
    totalFundsBalance,
    lastFundWithdrawal,
    fundsStatus,
    fundsErrorMessage,
    reloadFunds: loadFunds,

    isRefreshing,
    refresh,
  };
};
