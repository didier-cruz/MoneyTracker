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
  drawerStyle: {
    backgroundColor: colors[primary][0],
    width: '50%',
  },
  drawerItemStyle: {
    borderBottomColor: colors[primary][0],
    borderBottomWidth: 2,
  },
});
