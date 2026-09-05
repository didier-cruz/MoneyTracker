import {useState} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {Text} from '@components/atoms/text/Text';
import {ConfirmDialog} from '@components/organisms/feedback/ConfirmDialog';
import {IEnvelopeWithBalance} from '@db/queries';
import {accent, colors, gray, primary, secondary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useAchievementsScreen} from '@hooks/useAchievementsScreen';
import {AchievementCard} from './partials/AchievementCard';
import {MonthOutcomeCard} from './partials/MonthOutcomeCard';
import {getAchievedAmount, summarizeAchievements} from './mappers';
import {useTranslation} from 'react-i18next';

/**
 * La unica ruta a la que esta pantalla navega. Mismo patron (y mismo
 * motivo) que el `SiblingTabParamList` de `AnalysisScreen`: este
 * proyecto no expone un `ParamList` del drawer del que tirar, asi que
 * este tipo local al menos comprueba los nombres contra ESTA constante
 * en vez de contra un `any`.
 *
 * Hay que nombrar los tres niveles —`Home` (drawer) -> `RootNav`
 * (el stack que envuelve las pestanas) -> `Budgets` (la pestana)— y no
 * solo `Home`: navegar al drawer a secas devuelve a la pestana que
 * estuviera activa la ultima vez, que casi nunca es Presupuestos. Un
 * boton que dice "Ver mis sobres" y aterriza en Analisis no cumple lo
 * que promete.
 */
type DrawerParamList = {
  Home: {screen: 'RootNav'; params: {screen: 'Budgets'}};
};

/**
 * "Logros" — los sobres cumplidos.
 *
 * Vive en el menu lateral y no en las pestanas de abajo por dos
 * razones: las cuatro pestanas estan ocupadas y el FAB va en medio, y
 * esta es una pantalla de baja frecuencia a la que se entra a celebrar,
 * no a operar. El acceso secundario desde "Sobres" en Presupuestos
 * (`EnvelopesSection`) existe porque nadie entra a un menu lateral a
 * buscar algo cuya existencia desconoce.
 *
 * Es de solo lectura salvo por una accion: deshacer. Ver
 * `reopenEnvelope` para por que esa accion no es opcional.
 */
const AchievementsScreen = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProp<DrawerParamList>>();
  const {achievements, months, status, errorMessage, reload, reopen, isReopening} =
    useAchievementsScreen();
  const [pendingReopen, setPendingReopen] = useState<IEnvelopeWithBalance | null>(null);

  const summary = summarizeAchievements(achievements);

  const confirmReopen = async () => {
    if (pendingReopen === null) {
      return;
    }
    const envelope = pendingReopen;
    setPendingReopen(null);
    await reopen(envelope.id);
  };

  return (
    <ScreenTemplate
      headerTitle={t('achievements.title')}>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('achievements.loading')}
          />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <Text color={colors[secondary][0]} align="center" style={styles.message}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('achievements.retry')}
            onPress={reload}
            style={[styles.button, {backgroundColor: colors[secondary][0]}]}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && achievements.length === 0 && months.length === 0 && (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <VectorIcon name="trophy" color={colors[gray][0]} size={30} />
          </View>
          <Text size={16} bold align="center" style={styles.emptyTitle}>
            {t('achievements.emptyTitle')}
          </Text>
          <Text color={colors[gray][0]} align="center" style={styles.message}>
            {t('achievements.emptyMessage')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('achievements.goToEnvelopes')}
            onPress={() =>
              navigation.navigate('Home', {
                screen: 'RootNav',
                params: {screen: 'Budgets'},
              })
            }
            style={[styles.button, {backgroundColor: colors[primary][0]}]}>
            <Text color={colors[white][0]} bold>
              {t('achievements.goToEnvelopes')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dos secciones y no una lista mezclada: un logro de sobre es un
          acontecimiento unico con fecha propia, y un mes es un dictamen
          que se repite cada treinta dias. Juntos, doce meses de
          veredictos sepultarian "Ahorraste para Viaje Paris" en menos de
          un ano. Los encabezados solo aparecen si la seccion tiene algo,
          para que quien solo use una de las dos no vea un rotulo sobre
          un hueco. */}
      {status === 'success' && achievements.length > 0 && (
        <>
          <Text size={16} bold style={styles.sectionHeading}>
            {t('achievements.goalsSection')}
          </Text>
          {/* El resumen va bajo el encabezado de SU seccion, no de
              subtitulo de cabecera: `MainHeader` pinta el subtitulo a
              24px —tamano para una palabra— y ahi "3 metas cumplidas ·
              $24,000.00" parte en dos lineas. Y colgado del titulo de la
              pantalla parecia resumir tambien los meses, que cuentan
              otra cosa. */}
          <Text color={colors[gray][0]} size={13} style={styles.summary}>
            {t('achievements.summary', {
              count: summary.count,
              total: formatCentsToCurrency(summary.total),
            })}
          </Text>
          {achievements.map(envelope => (
            <AchievementCard
              key={envelope.id}
              envelope={envelope}
              disabled={isReopening}
              onPressReopen={setPendingReopen}
            />
          ))}
        </>
      )}

      {status === 'success' && months.length > 0 && (
        <>
          <Text size={16} bold style={styles.sectionHeading}>
            {t('achievements.monthsSection')}
          </Text>
          <Text color={colors[gray][0]} size={13} style={styles.summary}>
            {/* `count` y no `total`: i18next elige la forma plural por esa
                variable concreta, y sin ella una clave que solo tiene
                `_one`/`_other` no resuelve — se pinta el nombre de la
                clave en crudo. */}
            {t('achievements.monthsSummary', {
              clean: months.filter(month => month.exceededCount === 0).length,
              count: months.length,
            })}
          </Text>
          {months.map(outcome => (
            <MonthOutcomeCard key={outcome.period} outcome={outcome} />
          ))}
        </>
      )}

      <ConfirmDialog
        visible={pendingReopen !== null}
        tone="warning"
        title={t('achievements.reopenTitle')}
        // Dice EXACTAMENTE lo que va a pasar con el dinero. Deshacer
        // devuelve el saldo que `completeEnvelope` retiro, y ese es el
        // dato que decide si el usuario quiere seguir adelante.
        message={t('achievements.reopenMessage', {
          name: pendingReopen?.name ?? '',
          amount: formatCentsToCurrency(
            pendingReopen === null ? 0 : getAchievedAmount(pendingReopen),
          ),
        })}
        primaryLabel={t('achievements.reopen')}
        onPrimaryPress={confirmReopen}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={() => setPendingReopen(null)}
        onRequestClose={() => setPendingReopen(null)}
      />
    </ScreenTemplate>
  );
};

const styles = StyleSheet.create({
  summary: {
    width: '100%',
    marginBottom: 12,
  },
  sectionHeading: {
    width: '100%',
    marginTop: 8,
    marginBottom: 2,
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.inactive[0],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 6,
  },
  message: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  button: {
    height: 44,
    minWidth: 170,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AchievementsScreen;
