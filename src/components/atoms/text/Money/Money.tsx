import {FC} from 'react';
import {Text as RNText} from 'react-native';
import {formatCentsToCurrency} from '@utils/currency';

/**
 * Proporcion del tamano de los centavos respecto al de la cifra.
 *
 * 0.65 los deja claramente secundarios sin que dejen de leerse. Mas
 * abajo empiezan a costar de distinguir a un pulgar de distancia; mas
 * arriba no ahorra ancho suficiente para lo que se busca.
 */
const CENTS_RATIO = 0.65;

/**
 * Separa la parte decimal de un importe ya formateado.
 *
 * Se busca el separador AL FINAL seguido de exactamente dos digitos, y
 * se admiten punto y coma: el formateo va por `Intl` con la moneda fija
 * en `en-US` (ver `@utils/currency`), pero si algun dia se localiza, una
 * expresion atada al punto dejaria de partir nada y —esto es lo
 * importante— fallaria EN SILENCIO, mostrando el importe entero a
 * tamano completo sin que nadie lo note.
 */
const DECIMALS = /^(.*)([.,]\d{2})$/;

export interface MoneyProps {
  /** Centavos con signo. Nunca un flotante, nunca dolares. */
  cents: number;
  /**
   * Tamano de fuente de la CIFRA, el que use el `Text`/`Title` que
   * envuelve a este componente. Los centavos se dibujan a
   * `fontSize * 0.65`.
   *
   * Se pasa explicito porque React Native no tiene tamanos relativos:
   * un `Text` anidado no puede decir "el 65% de mi padre", solo un
   * numero absoluto.
   */
  fontSize: number;
}

/**
 * Un importe con los centavos mas pequenos que la cifra.
 *
 * Va DENTRO de un `Text` o un `Title` existente, no los sustituye: se
 * dibuja como una cadena suelta mas un `Text` anidado, asi que hereda
 * color, peso, familia y alineacion de quien lo envuelve y no hay dos
 * fuentes de verdad para el estilo.
 *
 *     <Title level={2}><Money cents={balance} fontSize={25} /></Title>
 *
 * El motivo es de espacio: `-$30,000.00` a 25px no cabia en una tarjeta
 * de 150 y partia el ultimo `0` a una segunda linea. Con los centavos al
 * 65% entra entero.
 */
export const Money: FC<MoneyProps> = ({cents, fontSize}) => {
  const formatted = formatCentsToCurrency(cents);
  const match = DECIMALS.exec(formatted);

  if (!match) {
    return <>{formatted}</>;
  }

  return (
    <>
      {match[1]}
      <RNText style={{fontSize: Math.round(fontSize * CENTS_RATIO)}}>{match[2]}</RNText>
    </>
  );
};

export default Money;
