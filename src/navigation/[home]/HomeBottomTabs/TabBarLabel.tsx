import {StyleSheet, Text} from 'react-native';

interface TabBarLabelProps {
  color: string;
  children: string;
}

/**
 * Etiqueta de pestana que se encoge en vez de cortarse.
 *
 * La etiqueta por defecto de React Navigation es una sola linea a 10dp
 * que, si no cabe, termina en "…". Con el tamano de fuente o de pantalla
 * del sistema por encima del normal, en espanol salian "Movimient…" y
 * "Presupues…": cada pestana mide 1/5 del ancho y el hueco del FAB no
 * deja repartir mas. Lo reportaron los verificadores de la prueba
 * cerrada (un Xiaomi con fuente grande) y se reprodujo en el emulador
 * con `font_scale 1.15` y densidad 480.
 *
 * `adjustsFontSizeToFit` reduce la fuente solo lo necesario para que
 * quepa la palabra entera, con `minimumFontScale` como piso para que no
 * quede ilegible. Se respeta el escalado de fuente del usuario en todos
 * los demas casos; solo cede cuando la palabra no cabe.
 *
 * El estilo copia el `labelBeneath` + `fonts.medium` de React Navigation
 * para que, cuando el texto cabe, se vea exactamente igual que antes.
 */
export const TabBarLabel = ({color, children}: TabBarLabelProps) => (
  <Text
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.7}
    style={[styles.label, {color}]}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontFamily: 'sans-serif-medium',
    fontWeight: 'normal',
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
});
