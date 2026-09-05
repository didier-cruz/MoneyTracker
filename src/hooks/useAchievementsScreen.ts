import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {
  getAllCategoryBudgetsWithSpent,
  getCompletedEnvelopes,
  getMonthlySpendingByCategory,
  IEnvelopeWithBalance,
  reopenEnvelope,
} from '@db/queries';
import {buildMonthOutcomes, IMonthOutcome} from '@screens/AchievementsScreen/monthlyOutcomes';

export type LoadStatus = 'loading' | 'success' | 'error';

/**
 * Logros: los sobres cumplidos, como cerro cada mes, y el unico camino
 * de vuelta desde un sobre.
 *
 * Las tres consultas van en paralelo y las dos de meses son de historial
 * completo (una fila por mes y categoria), no una por mes: ver
 * `getAllCategoryBudgetsWithSpent`.
 *
 * Sigue la misma forma que el resto de hooks de pantalla — `status` +
 * `errorMessage`, primera carga con spinner y recargas posteriores en
 * silencio (`hasLoadedRef`).
 */
export const useAchievementsScreen = () => {
  const {t} = useTranslation();
  const [achievements, setAchievements] = useState<IEnvelopeWithBalance[]>([]);
  const [months, setMonths] = useState<IMonthOutcome[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isReopening, setIsReopening] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    const silent = hasLoadedRef.current;
    if (!silent) {
      setStatus('loading');
    }
    setErrorMessage('');
    try {
      const db = await getDbConnection();
      const [envelopes, budgetRows, history] = await Promise.all([
        getCompletedEnvelopes(db),
        getAllCategoryBudgetsWithSpent(db),
        getMonthlySpendingByCategory(db),
      ]);
      setAchievements(envelopes);
      setMonths(buildMonthOutcomes(budgetRows, history));
      setStatus('success');
      hasLoadedRef.current = true;
    } catch (e: any) {
      console.warn('[useAchievementsScreen] load failed:', e?.message ?? e);
      if (!silent) {
        setErrorMessage(
          t('achievements.loadError', {message: e?.message ?? t('common.unknownError')}),
        );
        setStatus('error');
      }
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Devuelve el sobre a la lista activa con su saldo intacto.
   *
   * Al contrario que las recargas de fondo del resto de la app, un fallo
   * aqui NO se silencia en un `console.warn`: el usuario acaba de pedir
   * una accion concreta y necesita saber si ocurrio. Devuelve `true`
   * cuando salio bien para que la pantalla decida que mensaje mostrar.
   */
  const reopen = useCallback(
    async (id: number): Promise<boolean> => {
      setIsReopening(true);
      try {
        const db = await getDbConnection();
        await reopenEnvelope(db, id);
        await load();
        return true;
      } catch (e: any) {
        console.warn('[useAchievementsScreen] reopen failed:', e?.message ?? e);
        setErrorMessage(
          t('achievements.reopenError', {message: e?.message ?? t('common.unknownError')}),
        );
        return false;
      } finally {
        setIsReopening(false);
      }
    },
    [load, t],
  );

  return {achievements, months, status, errorMessage, reload: load, reopen, isReopening};
};

export default useAchievementsScreen;
