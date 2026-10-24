import {DrawerNavigationOptions} from '@react-navigation/drawer';
import {accent, colors, primary} from '@constants/colors/colors';

/**
 * Used to read `@redshank/native`'s `useTheme()` (`ThemeProvider`'s
 * `themeLight.colors` override) — migrated 1:1 to
 * `@constants/colors/colors`, verified hex-for-hex rather than assumed
 * from the similarly-named token in this file:
 * `themeLight.colors.accent` (`#C7FF70`) is `tokens.accent[0]`,
 * `.secondary` (`#8CC63F`) is `tokens.accent[1]`, `.primary`
 * (`#010062`) is `tokens.primary[0]`.
 */
export const drawerNavScreenOptions = (): DrawerNavigationOptions => ({
  headerShown: false,
  drawerType: 'slide',
  /**
   * El menu lateral se abre SOLO con su boton, no deslizando desde el
   * borde.
   *
   * El gesto por defecto se arma en una franja de 32dp desde el borde
   * izquierdo y le basta con 5dp de movimiento horizontal para ganar
   * (`SWIPE_EDGE_WIDTH` / `SWIPE_MIN_OFFSET` en
   * `react-native-drawer-layout`). Justo ahi viven ahora las listas
   * horizontales de cuentas, categorias y sobres, que sangran hasta el
   * borde a proposito para poder desplazarse hasta el filo: tocar la
   * primera tarjeta con el minimo balanceo del dedo abria el menu.
   * Tambien competia con el deslizamiento entre las pestanas
   * Cuentas/Categorias y con las filas de chips.
   *
   * Se desactiva y no se estrecha la franja porque el boton de menu
   * esta visible en todas las pantallas: el gesto no aportaba un acceso
   * que no existiera, solo una forma de abrirlo sin querer.
   */
  swipeEnabled: false,
  drawerActiveTintColor: colors[accent][0],
  drawerInactiveTintColor: colors[accent][1],
  headerTintColor: colors[accent][0],
  headerStyle: {
    backgroundColor: colors[primary][0],
  },
  /**
   * Ancho del menu: 75% de la pantalla con tope de 300dp.
   *
   * Estaba en un 50% fijo. En un telefono de ~360dp de ancho, o con el
   * tamano de pantalla del sistema agrandado (Honor Magic 7 Pro), eso
   * dejaba unos 180dp: tras el icono y los margenes de cada fila, a la
   * etiqueta le quedaba tan poco que Android partia las palabras por la
   * mitad ("Categ" / "orias") y el wordmark se salia por la derecha.
   * 75% con tope es el rango habitual de un menu lateral: ancho de sobra
   * en telefonos angostos, sin tapar casi toda la pantalla en uno ancho.
   * Reproducido en el emulador con densidad 520 y `font_scale 1.15`.
   */
  drawerStyle: {
    backgroundColor: colors[primary][0],
    width: '75%',
    maxWidth: 300,
  },
  drawerItemStyle: {
    borderBottomColor: colors[primary][0],
    borderBottomWidth: 2,
  },
});
