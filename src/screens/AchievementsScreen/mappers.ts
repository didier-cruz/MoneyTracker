import {IEnvelopeWithBalance} from '@db/queries';
import i18n from '@i18n';

/**
 * Logica de presentacion de Logros. Pura: no toca `@db/queries`, se
 * alimenta de lo que `useAchievementsScreen` ya cargo.
 */

/**
 * La cifra que se celebra.
 *
 * NO es el saldo: `completeEnvelope` lo deja en cero al cerrar. Y en las
 * deudas tampoco es `paidAmount`, aunque lo parezca — ese campo suma
 * TODOS los retiros, y el retiro de cierre es uno de ellos, asi que una
 * deuda de $12,500 que al saldarse tenia $300 sin aplicar reportaria
 * "$12,800 pagados", que es falso.
 *
 * - Deuda -> `targetAmount`, lo que se debia. Nunca es `null` (lo
 *   garantiza el `CHECK` de la tabla).
 * - Fondo CON meta -> `targetAmount`, la meta alcanzada.
 * - Fondo SIN meta -> `assignedTotal`, todo lo que llego a apartar.
 */
export const getAchievedAmount = (envelope: IEnvelopeWithBalance): number => {
  if (envelope.targetAmount !== null) {
    return envelope.targetAmount;
  }
  return envelope.assignedTotal;
};

/**
 * "te tomó 7 meses" / "te tomó 12 días" / "lo lograste el mismo día".
 *
 * Cambia de unidad en el mes porque son las dos escalas en las que la
 * gente piensa una meta de ahorro; con menos de un mes, decir "0 meses"
 * no dice nada. Devuelve `undefined` si alguna de las dos fechas falta o
 * no se puede interpretar, y la tarjeta simplemente omite la linea en
 * lugar de mostrar "NaN meses".
 */
export const buildDurationLabel = (
  createdAt: string,
  completedAt: string | null,
): string | undefined => {
  if (completedAt === null) {
    return undefined;
  }
  const start = new Date(createdAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return undefined;
  }
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return String(i18n.t('achievements.tookSameDay'));
  }
  if (days < 30) {
    return String(i18n.t('achievements.tookDays', {count: days}));
  }
  return String(i18n.t('achievements.tookMonths', {count: Math.round(days / 30)}));
};

export interface IAchievementsSummary {
  count: number;
  /** Cents: la suma de cada `getAchievedAmount`. */
  total: number;
}

/** El subtitulo de la cabecera: "3 metas cumplidas · $24,000.00". Es la
 * cifra que no existe en ninguna otra pantalla de la app. */
export const summarizeAchievements = (
  envelopes: IEnvelopeWithBalance[],
): IAchievementsSummary => ({
  count: envelopes.length,
  total: envelopes.reduce((sum, envelope) => sum + getAchievedAmount(envelope), 0),
});
