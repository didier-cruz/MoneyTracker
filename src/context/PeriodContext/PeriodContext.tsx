import {createContext, FC, ReactNode, useContext, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  DEFAULT_PERIOD,
  IResolvedPeriod,
  PeriodSelection,
  resolvePeriod,
} from '@utils/periodSelection';

/**
 * El periodo que mira toda la app.
 *
 * Es el PRIMER estado compartido de este proyecto: hasta ahora cada hook
 * consultaba por su cuenta y se refrescaba con `useFocusEffect`, sin
 * nada en comun. Se introduce aqui porque el periodo es justo lo que NO
 * puede diferir entre pantallas: que Balance hable de septiembre y
 * Analisis de agosto es la misma clase de incoherencia que el fallo de
 * UTC contra hora local que acabamos de corregir.
 *
 * Guarda la INTENCION (`PeriodSelection`) y expone tambien el tramo ya
 * resuelto. La resolucion se recalcula en cada render del proveedor, no
 * se memoriza contra el reloj: "este mes" tiene que seguir siendo este
 * mes cuando cruza la medianoche del dia 1.
 *
 * NO se persiste a proposito. Un periodo pegajoso entre sesiones seria
 * una trampa: abres la app dias despues, ves cifras de un tramo viejo y
 * nada grita que no es hoy.
 */
interface PeriodContextValue {
  selection: PeriodSelection;
  setSelection: (selection: PeriodSelection) => void;
  resolved: IResolvedPeriod;
}

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

export const PeriodProvider: FC<{children: ReactNode}> = ({children}) => {
  const [selection, setSelection] = useState<PeriodSelection>(DEFAULT_PERIOD);
  /**
   * El idioma entra en las dependencias porque `resolvePeriod` produce
   * una ETIQUETA traducida ("septiembre de 2026", "Todo el histórico").
   *
   * Sin el, la etiqueta se calculaba una sola vez y quedaba congelada en
   * el idioma que hubiera en ese instante — que al arrancar es el del
   * DISPOSITIVO, porque `hydrateStoredLanguage()` es asincrono y termina
   * despues. Se veia "September 2026" con la app en español. Y ademas
   * dejaba de seguir al conmutador EN/ES del menu lateral.
   */
  const {i18n} = useTranslation();

  const value = useMemo<PeriodContextValue>(
    () => ({selection, setSelection, resolved: resolvePeriod(selection)}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, i18n.language],
  );

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
};

/**
 * Lanza si se usa fuera del proveedor. Es deliberado: devolver un
 * periodo por defecto en silencio dejaria una pantalla mirando un tramo
 * distinto al resto sin que nadie se entere, que es exactamente lo que
 * este contexto viene a impedir.
 */
export const usePeriod = (): PeriodContextValue => {
  const value = useContext(PeriodContext);
  if (value === undefined) {
    throw new Error('usePeriod debe usarse dentro de <PeriodProvider>');
  }
  return value;
};
