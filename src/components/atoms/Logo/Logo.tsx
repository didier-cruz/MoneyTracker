import React, {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, G, Path, Rect} from 'react-native-svg';
import {accent, colors, primary} from '@constants/colors/colors';
import {Text} from '@components/atoms/text/Text';

/**
 * Marca de la app: un sobre abierto con tres billetes asomando.
 *
 * Sustituye a un `<Image source={{uri: 'https://firebasestorage...'}}>` que
 * ademas de venir de fuera mostraba el nombre equivocado ("MONEY FLOW").
 * Esa URL era la UNICA peticion de red de la app y la unica razon del
 * permiso INTERNET, que se pudo retirar del manifest de `main` al dibujar
 * la marca en local (sigue en el de `debug`, donde Metro si lo usa).
 *
 * El sobre no es una metafora generica de finanzas: es la mecanica real de
 * esta app — la tabla `envelopes`, apartar dinero hacia una meta. Ninguna
 * de las ocho apps "Money Tracker" de Play usa ese simbolo.
 *
 * SVG y no PNG porque no hay ningun `src/assets` al que pertenecer, escala
 * sin densidades @2x/@3x, y toma los colores de `@constants/colors` en vez
 * de hornearlos: si la paleta cambia, la marca cambia con ella.
 *
 * El recorrido de diseno completo — con las variantes descartadas y las
 * escaleras de tamano que decidieron cada recorte — esta en
 * `docs/design/logo-proposals.html`.
 */

/** Los tres billetes: [x, y, ancho, alto, rotacion, origenX, origenY, color].
 * Escalonados en tres limas para dar profundidad sin degradados: el de
 * atras es el mas apagado, el de delante el que lleva la atencion. */
const BILLS = [
  [12, 6, 15, 14, -14, 19.5, 13, colors[accent][1]],
  [15, 8, 16, 14, -5, 23, 15, colors[accent][2]],
  [18, 11, 16, 13, 6, 26, 17.5, colors[accent][0]],
] as const;

interface LogoProps {
  /** Lado del cuadrado de la marca, en px. El wordmark no escala con el:
   * es un lockup de cabecera, no un icono redimensionable. */
  markSize?: number;
  /**
   * Color de los AGUJEROS del diseno — el pliegue del sobre y el sello del
   * billete. No son un tono de la paleta: son huecos por los que se ve el
   * fondo, asi que tienen que recibir el color del contenedor real.
   *
   * Por defecto el indigo del drawer, que es donde vive hoy. Si esta marca
   * se pinta alguna vez sobre `surface[0]`, hay que pasarle ESE color o el
   * pliegue aparece como una mancha indigo en vez de como un hueco.
   */
  holeColor?: string;
  /** Oculta el wordmark y deja solo el simbolo. */
  markOnly?: boolean;
}

export const Logo: FC<LogoProps> = ({
  markSize = 40,
  holeColor = colors[primary][0],
  markOnly = false,
}) => (
  <View style={markOnly ? undefined : styles.lockup}>
    <Svg width={markSize} height={markSize} viewBox="0 0 48 48">
      {/* El conjunto ocupaba de y~4 a y=38 en un lienzo de 48 y quedaba alto
          en el marco — invisible en un recorte cuadrado, evidente en uno
          circular. Medido comparando ambas versiones, no estimado. */}
      <G translateY={3}>
        {BILLS.map(([x, y, w, h, rotation, oX, oY, fill]) => (
          <Rect
            key={fill}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={2}
            fill={fill}
            rotation={rotation}
            originX={oX}
            originY={oY}
          />
        ))}
        <Circle cx={26} cy={17} r={3.2} fill={holeColor} />
        <Rect x={7} y={19} width={34} height={19} rx={3} fill={colors[primary][1]} />
        <Path d="M7,19 L24,30 L41,19 Z" fill={holeColor} />
      </G>
    </Svg>
    {!markOnly && (
      <Text
        size="base"
        bold
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        color={colors.white[0]}
        style={styles.wordmark}>
        Money
        <Text size="base" bold color={colors[accent][0]}>
          Tracker
        </Text>
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  wordmark: {
    // Sin `flexShrink` el texto no tenia cota de ancho dentro de la fila
    // y, en un menu angosto, se salia por la derecha ("MoneyTrac") en vez
    // de encoger con `adjustsFontSizeToFit`.
    flexShrink: 1,
    marginLeft: 10,
    letterSpacing: -0.3,
  },
});
