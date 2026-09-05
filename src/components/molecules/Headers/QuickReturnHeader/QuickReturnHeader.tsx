import {FC, ReactNode, useCallback, useRef, useState} from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Cuanto hay que arrastrar, acumulado, antes de ocultar o mostrar. Sin
 * umbral la cabecera conmuta con cualquier microgesto del dedo y
 * tiembla; 30px (~11dp) es suficiente para que solo responda a una
 * intencion clara de desplazarse.
 */
const TOGGLE_THRESHOLD = 30;

/**
 * Por debajo de este desplazamiento la cabecera SIEMPRE esta visible.
 * Ocultarla en los primeros pixeles daria un parpadeo nada mas tocar la
 * lista, cuando todavia no hace falta el espacio.
 */
const MIN_OFFSET_TO_HIDE = 60;

const ANIMATION_MS = 180;

/**
 * Cuanto se ignoran los eventos de scroll despues de conmutar.
 *
 * Al colapsar, la lista crece y el sistema REAJUSTA el offset —medido en
 * el emulador: saltos de -18 y +28 px seguidos, con el dedo todavia
 * apoyado y moviendose ~2px por evento—. Ese salto lo provoca la propia
 * animacion, no el usuario, y cruzaba el umbral en sentido contrario:
 * ocultar hacia crecer la lista, el salto la volvia a mostrar, y eso la
 * encogia otra vez. Se veia solo arrastrando despacio, que es cuando los
 * deltas del dedo son mas pequenos que los del colapso.
 *
 * Un poco mas que la animacion, para cubrir tambien el reajuste de
 * layout que llega justo despues de que termine.
 */
const SETTLE_MS = ANIMATION_MS + 220;

export interface QuickReturnController {
  /** Se engancha al `onScroll` de la lista. */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Se engancha al `onContentSizeChange` de la lista. NO es opcional
   * aunque lo parezca: es el unico aviso que llega cuando la lista
   * ENCOGE sin que nadie la desplace —al borrar una cuenta, al plegar
   * una fila desplegada, al filtrar con el buscador—. Sin el, una lista
   * que deja de desbordarse no vuelve a emitir un solo evento de scroll
   * y la cabecera se queda oculta para siempre.
   */
  onContentSizeChange: (width: number, height: number) => void;
  /** Interno, lo consume `QuickReturnHeader`. */
  hidden: Animated.SharedValue<number>;
  /** Interno: `QuickReturnHeader` reporta aqui su altura medida. */
  reportHeight: (height: number) => void;
}

export interface UseQuickReturnHeaderOptions {
  /**
   * Mientras sea `true` la cabecera no se oculta pase lo que pase.
   *
   * Existe por el buscador: si tiene el foco o texto escrito y la lista
   * se mueve, esconderlo deja al usuario tecleando en un campo que ya
   * no ve.
   */
  locked?: boolean;
}

/**
 * Cabecera "quick return": se retira al desplazarse hacia ABAJO y vuelve
 * en cuanto se desplaza hacia ARRIBA, sin esperar a llegar al tope.
 *
 * El disparo se calcula en JS y solo la animacion vive en Reanimated. Es
 * deliberado: `useAnimatedScrollHandler` obliga a envolver la lista en
 * un componente animado —y estas pantallas usan `SectionList`, que se
 * lleva mal con `createAnimatedComponent`—, mientras que lo que se
 * anima aqui es un interruptor con umbral, no un seguimiento pixel a
 * pixel, asi que la latencia del hilo de JS no se percibe.
 */
export const useQuickReturnHeader = ({
  locked = false,
}: UseQuickReturnHeaderOptions = {}): QuickReturnController => {
  const hidden = useSharedValue(0);
  const lastOffset = useRef(0);
  const accumulated = useRef(0);
  /**
   * El destino que ya se pidio (0 visible, 1 oculto).
   *
   * Sin esto se llamaba a `withTiming` en CADA evento de scroll mientras
   * se estaba en la zona alta, es decir unas 60 veces por segundo,
   * reiniciando la animacion antes de que terminara: el valor no
   * llegaba nunca a asentarse.
   */
  const target = useRef(0);
  /** Hasta cuando ignorar el scroll por el reajuste que causa el propio
   * colapso (ver `SETTLE_MS`). */
  const settleUntil = useRef(0);
  /**
   * Si el evento ANTERIOR ya estaba en la zona alta.
   *
   * El reajuste del colapso no solo desplaza el offset: durante un
   * evento suelto lo devuelve casi a cero. Medido: la secuencia real fue
   * 89.5 -> 1.5 -> 140.7, con el dedo bajando sin parar. Ese 1.5 falso
   * disparaba la regla de "estas en el tope, muestrate" y devolvia la
   * cabecera en mitad del gesto. Exigiendo DOS eventos seguidos en la
   * zona alta, un pico de uno solo ya no la despierta.
   */
  const wasNearTop = useRef(true);
  /**
   * Alto medido del bloque que se retira, reportado por
   * `QuickReturnHeader`. Hace falta para saber cuanto recorrido GANA la
   * lista al ocultarlo, que es lo que decide si ocultarlo es siquiera
   * reversible — ver `canHide`.
   */
  const headerHeight = useRef(0);
  /** Alto del area visible de la lista, del ultimo evento de scroll. */
  const viewportHeight = useRef(0);

  const animateTo = useCallback(
    (value: 0 | 1) => {
      if (target.current === value) {
        return;
      }
      target.current = value;
      settleUntil.current = Date.now() + SETTLE_MS;
      hidden.value = withTiming(value, {duration: ANIMATION_MS});
    },
    [hidden],
  );

  /**
   * Mostrar sin condiciones y olvidar lo acumulado. La salida de
   * emergencia de todos los caminos que terminan en "esto no deberia
   * estar oculto".
   */
  const forceShow = useCallback(() => {
    accumulated.current = 0;
    animateTo(0);
  }, [animateTo]);

  /**
   * Si ocultar la cabecera dejaria a la lista SIN recorrido suficiente
   * para volver a mostrarla.
   *
   * Este es el fallo que arreglo esta funcion, y era estructural, no de
   * calibracion: la unica via para devolver la cabecera vive dentro de
   * `onScroll`. Con una lista que apenas desborda —ocho cuentas en
   * Cuentas—, ocultarla le regalaba a la lista justo los pixeles que le
   * faltaban para caber entera; sin desbordamiento no hay un solo evento
   * de scroll mas, y sin eventos no hay forma de pedir que vuelva. La
   * cabecera se ocultaba a si misma dentro de un callejon sin salida.
   *
   * Reproducido en el emulador (Cuentas, 8 cuentas): tras un
   * desplazamiento hacia abajo, el bloque de buscador y accesos
   * desaparecia y ni desplazando hacia arriba tres veces seguidas volvia.
   *
   * `scrollable` ya descuenta la cabecera cuando esta oculta —el
   * `layoutMeasurement` de la lista crecio al colapsarla—, asi que solo
   * hay que restarla cuando todavia se ve.
   */
  const canHide = useCallback((scrollable: number, isHidden: boolean): boolean => {
    const scrollableOnceHidden = isHidden ? scrollable : scrollable - headerHeight.current;
    return scrollableOnceHidden > MIN_OFFSET_TO_HIDE;
  }, []);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (viewportHeight.current === 0) {
        return;
      }
      if (!canHide(height - viewportHeight.current, target.current === 1)) {
        forceShow();
      }
    },
    [canHide, forceShow],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
      const offset = contentOffset.y;
      viewportHeight.current = layoutMeasurement.height;

      // Ventana de asentamiento: se actualiza la referencia pero no se
      // acumula nada, para que el salto de offset que provoca el propio
      // colapso no cuente como gesto del usuario.
      if (Date.now() < settleUntil.current) {
        lastOffset.current = offset;
        accumulated.current = 0;
        // Tambien se mantiene al dia la bandera del tope: dejarla rancia
        // obligaba, al salir de la ventana, a DOS eventos mas en la zona
        // alta antes de que la regla de "estas arriba, muestrate"
        // pudiera dispararse.
        wasNearTop.current = offset <= MIN_OFFSET_TO_HIDE;
        return;
      }

      // Antes que cualquier gesto: si ocultarla no seria reversible, no
      // se oculta — y si ya lo estaba, se devuelve.
      if (!canHide(contentSize.height - layoutMeasurement.height, target.current === 1)) {
        lastOffset.current = offset;
        forceShow();
        return;
      }

      const delta = offset - lastOffset.current;
      lastOffset.current = offset;

      // En el tope siempre visible, y con `locked` tambien: los dos
      // casos anulan cualquier acumulado pendiente.
      const nearTop = offset <= MIN_OFFSET_TO_HIDE;
      const confirmedNearTop = nearTop && wasNearTop.current;
      wasNearTop.current = nearTop;

      if (locked || confirmedNearTop) {
        forceShow();
        return;
      }

      // Un pico aislado hacia la zona alta es reajuste, no gesto: se
      // resincroniza la referencia y se deja pasar sin acumular.
      if (nearTop) {
        lastOffset.current = offset;
        accumulated.current = 0;
        return;
      }

      // Un delta de CERO no es un cambio de sentido y no debe tocar el
      // acumulado.
      //
      // Aqui estaba el fallo del arrastre lento: la comparacion era
      // `delta > 0 !== accumulated > 0`, y con `delta === 0` el lado
      // izquierdo vale `false`, asi que cada evento sin movimiento
      // —que en un arrastre lento son casi todos, porque el dedo avanza
      // menos de un pixel entre evento y evento— borraba el acumulado.
      // Nunca llegaba al umbral durante el gesto y la cabecera se
      // ocultaba de golpe al soltar, cuando la inercia producia deltas
      // grandes. Reproducido en el emulador: 5 segundos arrastrando, la
      // lista desplazandose, y el buscador intacto en las seis capturas.
      if (delta !== 0 && delta > 0 !== accumulated.current > 0) {
        accumulated.current = 0;
      }
      accumulated.current += delta;

      if (accumulated.current > TOGGLE_THRESHOLD) {
        accumulated.current = 0;
        animateTo(1);
      } else if (accumulated.current < -TOGGLE_THRESHOLD) {
        accumulated.current = 0;
        animateTo(0);
      }
    },
    [animateTo, canHide, forceShow, locked],
  );

  const reportHeight = useCallback((height: number) => {
    headerHeight.current = height;
  }, []);

  return {onScroll, onContentSizeChange, hidden, reportHeight};
};

export interface QuickReturnHeaderProps {
  controller: QuickReturnController;
  children: ReactNode;
}

/**
 * Envoltorio del bloque que se retira. Mide su contenido una vez y a
 * partir de ahi anima SU PROPIA altura entre eso y cero.
 *
 * Se anima la altura y no un `translateY`: desplazando el bloque hacia
 * arriba seguiria ocupando su hueco y la lista no ganaria ni un pixel,
 * que es justo lo que se busca. Por eso el hijo lleva su altura medida
 * fijada — si no, al encoger el contenedor el contenido se aplastaria
 * en vez de recortarse.
 */
export const QuickReturnHeader: FC<QuickReturnHeaderProps> = ({controller, children}) => {
  const [height, setHeight] = useState<number>();

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.height;
      // Solo la primera medida: despues el contenedor ya esta animando
      // su alto y volver a leerlo realimentaria la animacion.
      if (height === undefined && measured > 0) {
        setHeight(measured);
        // El controlador la necesita para saber cuanto recorrido gana la
        // lista al colapsar — ver `canHide`.
        controller.reportHeight(measured);
      }
    },
    [height, controller],
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (height === undefined) {
      return {};
    }
    return {
      height: height * (1 - controller.hidden.value),
      opacity: 1 - controller.hidden.value,
    };
  }, [height]);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View onLayout={onLayout} style={height !== undefined ? {height} : undefined}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});

export default QuickReturnHeader;
