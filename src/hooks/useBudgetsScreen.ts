import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {
  archiveEnvelope,
  assignToEnvelope,
  completeEnvelope,
  copyCategoryBudgetsToPeriod,
  getAllCategoryBudgetsWithSpent,
  CompleteEnvelopeRejection,
  getAvailableToAssign,
  getCompletedEnvelopes,
  getCategoriesByType,
  getCategoryBudgets,
  getEnvelopes,
  ICategoryBudgetWithSpent,
  IEnvelopeWithBalance,
  setCategoryBudget,
  deleteCategoryBudget,
  withdrawFromEnvelope,
} from '@db/queries';
import {usePeriod} from '@context/PeriodContext';
import {currentMonth} from '@utils/periodSelection';
import {
  buildRolloverSuggestions,
  buildStreaks,
  IRolloverSuggestion,
} from '@screens/AchievementsScreen/monthlyOutcomes';

export type LoadStatus = 'loading' | 'success' | 'error';

/**
 * All state/data-fetching for `BudgetsScreen`'s two independent
 * sections — Envelopes (Sobres) and this month's category limits —
 * plus the mutations both sections' modals need (assign/withdraw,
 * archive, set-limit). Split out of the screen component itself,
 * matching `useAccountsScreen`'s existing screen-hook/thin-render split.
 *
 * The two sections are deliberately tracked as two independent
 * load/error states, not one combined status: they read from
 * unrelated tables (`envelopes`/`envelope_movements` vs
 * `category_budgets`+`finances`) and answer unrelated questions ("cuánto
 * tengo apartado" vs "cuánto llevo gastado" — see this slice's product
 * note), so one section failing to load has no reason to blank out the
 * other.
 *
 * Reloaded on every focus regain (`useFocusEffect`), not just on mount —
 * the user can archive/create/assign from THIS screen's own
 * sub-screens/modals and come back here, and a category's spend can
 * change from a transaction entered on a completely different tab
 * (`FormScreen`) — a mount-only effect would show stale numbers on
 * return. The very first load of each section shows a full loading
 * state; every reload after that is "silent" (no spinner flash) for the
 * same reason `useAccountsScreen` does this — a local SQLite read is
 * fast enough that flashing a spinner on every tab-focus would be pure
 * noise. Pull-to-refresh's own explicit spinner (`isRefreshing`) still
 * exists for when the user asks for one.
 */
export const useBudgetsScreen = () => {
  const {t} = useTranslation();
  /**
   * El mes que mira esta pantalla, tomado del periodo global.
   *
   * Se usa `anchorMonth` y no el tramo entero porque un limite vive en
   * `category_budgets` con `UNIQUE (idCategory, period)`: es mensual por
   * esquema, no admite rangos. Si el periodo global fuera "ultimos 3
   * meses", esta pantalla muestra el mes mas reciente de ese tramo, y su
   * selector se abre en modo `monthsOnly` para no ofrecer atajos que no
   * puede honrar.
   *
   * Antes era `useRef(getCurrentPeriod()).current`, que congelaba el mes
   * AL MONTAR: con la app abierta cruzando la medianoche del dia 1,
   * Presupuestos seguia enseñando el mes viejo hasta reiniciarla.
   */
  const {resolved} = usePeriod();
  const period = resolved.anchorMonth;

  const [envelopes, setEnvelopes] = useState<IEnvelopeWithBalance[]>([]);
  /** Solo el CONTEO. La pantalla de Logros carga los suyos por su
   * cuenta; aqui esto unicamente decide si se pinta el enlace. */
  const [achievementsCount, setAchievementsCount] = useState(0);
  const [envelopesStatus, setEnvelopesStatus] = useState<LoadStatus>('loading');
  const [envelopesErrorMessage, setEnvelopesErrorMessage] = useState('');
  const [availableToAssign, setAvailableToAssign] = useState<number>(0);
  const hasLoadedEnvelopesRef = useRef(false);

  const [budgets, setBudgets] = useState<ICategoryBudgetWithSpent[]>([]);
  const [budgetsStatus, setBudgetsStatus] = useState<LoadStatus>('loading');
  const [budgetsErrorMessage, setBudgetsErrorMessage] = useState('');
  const [expenseCategories, setExpenseCategories] = useState<ICategory[]>([]);
  const hasLoadedBudgetsRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadEnvelopes = useCallback(async () => {
    const silent = hasLoadedEnvelopesRef.current;
    if (!silent) {
      setEnvelopesStatus('loading');
    }
    setEnvelopesErrorMessage('');
    try {
      const db = await getDbConnection();
      const [envelopesResult, availableResult, completedResult] = await Promise.all([
        getEnvelopes(db),
        getAvailableToAssign(db),
        getCompletedEnvelopes(db),
      ]);
      setEnvelopes(envelopesResult);
      setAvailableToAssign(availableResult);
      setAchievementsCount(completedResult.length);
      setEnvelopesStatus('success');
      hasLoadedEnvelopesRef.current = true;
    } catch (e: any) {
      console.warn('[useBudgetsScreen] loadEnvelopes failed:', e?.message ?? e);
      if (!silent) {
        setEnvelopesErrorMessage(
          t('budgets.loadEnvelopesError', {message: e?.message ?? t('common.unknownError')}),
        );
        setEnvelopesStatus('error');
      }
    }
  }, [t]);

  const loadBudgets = useCallback(async () => {
    const silent = hasLoadedBudgetsRef.current;
    if (!silent) {
      setBudgetsStatus('loading');
    }
    setBudgetsErrorMessage('');
    try {
      const db = await getDbConnection();
      const [budgetsResult, categoriesResult, historyResult] = await Promise.all([
        getCategoryBudgets(db, period),
        getCategoriesByType(db, 'expense'),
        getAllCategoryBudgetsWithSpent(db),
      ]);
      setBudgets(budgetsResult);
      setExpenseCategories(categoriesResult);
      setStreaksByCategory(
        new Map([...buildStreaks(historyResult)].map(([id, streak]) => [id, streak.months])),
      );
      setRolloverSuggestions(buildRolloverSuggestions(historyResult));
      setBudgetsStatus('success');
      hasLoadedBudgetsRef.current = true;
    } catch (e: any) {
      console.warn('[useBudgetsScreen] loadBudgets failed:', e?.message ?? e);
      if (!silent) {
        setBudgetsErrorMessage(
          t('budgets.loadLimitsError', {message: e?.message ?? t('common.unknownError')}),
        );
        setBudgetsStatus('error');
      }
    }
  }, [period, t]);

  useFocusEffect(
    useCallback(() => {
      loadEnvelopes();
      loadBudgets();
    }, [loadEnvelopes, loadBudgets]),
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadEnvelopes(), loadBudgets()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEnvelopes, loadBudgets]);

  /**
   * Categories still eligible for a NEW limit this period — every
   * `expense` category minus the ones `budgets` already covers. Feeds
   * `CategoryLimitModal`'s "add" picker; editing an EXISTING row's
   * limit never goes through this list (that modal opens already
   * knowing its category, see `BudgetsScreen`).
   */
  const categoriesWithoutBudget = expenseCategories.filter(
    category => !budgets.some(budget => budget.idCategory === category.id),
  );

  /**
   * Records an assignment into one envelope, then reloads the envelope
   * list so its card's balance/`availableToAssign` reflect it
   * immediately. Never throws for over-allocation — see
   * `envelopesQueries.ts`'s top-of-file doc — `overAllocated` here is a
   * non-blocking signal for `BudgetsScreen` to show as a follow-up
   * notice, never a reason to undo or reject the write that already
   * happened. Returns `null` on an actual failure (invalid amount,
   * envelope gone) so the caller can show its own alert.
   */
  const assignToEnvelopeById = useCallback(
    async (idEnvelope: number, amount: number, note?: string) => {
      try {
        const db = await getDbConnection();
        const result = await assignToEnvelope(db, {idEnvelope, amount, note});
        await loadEnvelopes();
        return result;
      } catch (e: any) {
        console.warn('[useBudgetsScreen] assignToEnvelopeById failed:', e?.message ?? e);
        return null;
      }
    },
    [loadEnvelopes],
  );

  /** Same shape as `assignToEnvelopeById`, for a withdrawal — see
   * `withdrawFromEnvelope`'s own non-blocking `envelopeOverdrawn`
   * signal. */
  const withdrawFromEnvelopeById = useCallback(
    async (idEnvelope: number, amount: number, note?: string) => {
      try {
        const db = await getDbConnection();
        const result = await withdrawFromEnvelope(db, {idEnvelope, amount, note});
        await loadEnvelopes();
        return result;
      } catch (e: any) {
        console.warn(
          '[useBudgetsScreen] withdrawFromEnvelopeById failed:',
          e?.message ?? e,
        );
        return null;
      }
    },
    [loadEnvelopes],
  );

  const [isArchivingEnvelope, setIsArchivingEnvelope] = useState(false);

  /** Archives (soft-deletes) one envelope, then reloads the list so it
   * disappears immediately — same shape as `useAccountsScreen`'s
   * `archiveAccountById`. */
  const archiveEnvelopeById = useCallback(
    async (id: number): Promise<boolean> => {
      setIsArchivingEnvelope(true);
      try {
        const db = await getDbConnection();
        await archiveEnvelope(db, id);
        await loadEnvelopes();
        return true;
      } catch (e: any) {
        console.warn('[useBudgetsScreen] archiveEnvelopeById failed:', e?.message ?? e);
        return false;
      } finally {
        setIsArchivingEnvelope(false);
      }
    },
    [loadEnvelopes],
  );

  /**
   * Rachas y arrastre salen de la MISMA consulta de historial que usa
   * Logros. Se carga junto a los limites del mes porque las dos cosas
   * cuelgan de `category_budgets` y cambian a la vez: poner o borrar un
   * limite altera el mes actual y puede alterar una racha.
   */
  const [streaksByCategory, setStreaksByCategory] = useState<Map<number, number>>(new Map());
  const [rolloverSuggestions, setRolloverSuggestions] = useState<IRolloverSuggestion[]>([]);
  const [isApplyingRollover, setIsApplyingRollover] = useState(false);

  const [isCompletingEnvelope, setIsCompletingEnvelope] = useState(false);

  /**
   * Cierra un sobre cumplido y lo manda a Logros.
   *
   * Devuelve el motivo del rechazo en lugar de un booleano porque los
   * tres casos que `completeEnvelope` puede rechazar quieren mensajes
   * distintos, y el mas probable —`goalNotReached`— ni siquiera es un
   * error: el usuario pudo retirar dinero desde otra pantalla entre que
   * vio el CTA y lo toco. `'failed'` se reserva para un fallo real de
   * escritura.
   */
  const completeEnvelopeById = useCallback(
    async (id: number): Promise<CompleteEnvelopeRejection | 'failed' | null> => {
      setIsCompletingEnvelope(true);
      try {
        const db = await getDbConnection();
        const {rejectedBecause} = await completeEnvelope(db, id);
        await loadEnvelopes();
        return rejectedBecause;
      } catch (e: any) {
        console.warn('[useBudgetsScreen] completeEnvelopeById failed:', e?.message ?? e);
        return 'failed';
      } finally {
        setIsCompletingEnvelope(false);
      }
    },
    [loadEnvelopes],
  );

  /**
   * Crea en el mes EN CURSO los limites propuestos por la tarjeta de
   * arrastre.
   *
   * Recibe los importes ya resueltos y no las sugerencias tal cual,
   * porque la pantalla permite ajustar alguno antes de aceptar: lo que
   * se guarda es lo que el usuario vio, no lo que el algoritmo propuso.
   */
  const applyRollover = useCallback(
    async (limits: {idCategory: number; limitAmount: number}[]): Promise<boolean> => {
      setIsApplyingRollover(true);
      try {
        const db = await getDbConnection();
        await copyCategoryBudgetsToPeriod(db, currentMonth(), limits);
        await loadBudgets();
        return true;
      } catch (e: any) {
        console.warn('[useBudgetsScreen] applyRollover failed:', e?.message ?? e);
        return false;
      } finally {
        setIsApplyingRollover(false);
      }
    },
    [loadBudgets],
  );

  const [isSavingLimit, setIsSavingLimit] = useState(false);

  /**
   * Sets (creates or updates) one category's limit for THIS screen's
   * current `period`, then reloads the limits list so the new/changed
   * row (with its freshly-resolved `spent`/`remaining`) appears right
   * away. Returns `false` on failure — including `setCategoryBudget`'s
   * own `Cannot set a budget on an income category` throw, which
   * `CategoryLimitModal`'s category picker already prevents reaching by
   * only ever listing `expense` categories, but this is not re-checked
   * here a second time — the query layer's own guard is the real one.
   */
  const setCategoryLimit = useCallback(
    async (idCategory: number, limitAmount: number): Promise<boolean> => {
      setIsSavingLimit(true);
      try {
        const db = await getDbConnection();
        await setCategoryBudget(db, {idCategory, period, limitAmount});
        await loadBudgets();
        return true;
      } catch (e: any) {
        console.warn('[useBudgetsScreen] setCategoryLimit failed:', e?.message ?? e);
        return false;
      } finally {
        setIsSavingLimit(false);
      }
    },
    [period, loadBudgets],
  );

  const [isDeletingLimit, setIsDeletingLimit] = useState(false);

  /**
   * Borra un limite y recarga la lista para que la fila desaparezca al
   * momento. Misma forma que `archiveEnvelopeById`, salvo que aqui el
   * borrado es real: ver `deleteCategoryBudget` para por que un limite
   * no se archiva.
   */
  const deleteCategoryLimitById = useCallback(
    async (id: number): Promise<boolean> => {
      setIsDeletingLimit(true);
      try {
        const db = await getDbConnection();
        await deleteCategoryBudget(db, id);
        await loadBudgets();
        return true;
      } catch (e: any) {
        console.warn('[useBudgetsScreen] deleteCategoryLimitById failed:', e?.message ?? e);
        return false;
      } finally {
        setIsDeletingLimit(false);
      }
    },
    [loadBudgets],
  );

  return {
    period,

    envelopes,
    envelopesStatus,
    envelopesErrorMessage,
    reloadEnvelopes: loadEnvelopes,
    availableToAssign,
    achievementsCount,

    budgets,
    budgetsStatus,
    budgetsErrorMessage,
    reloadBudgets: loadBudgets,
    categoriesWithoutBudget,
    streaksByCategory,
    rolloverSuggestions,
    applyRollover,
    isApplyingRollover,

    isRefreshing,
    refresh,

    assignToEnvelopeById,
    withdrawFromEnvelopeById,
    archiveEnvelopeById,
    isArchivingEnvelope,
    completeEnvelopeById,
    isCompletingEnvelope,

    setCategoryLimit,
    isSavingLimit,
    deleteCategoryLimitById,
    isDeletingLimit,
  };
};
