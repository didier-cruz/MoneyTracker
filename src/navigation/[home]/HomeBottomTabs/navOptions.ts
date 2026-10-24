import {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs';
import {accent, colors, primary} from '@constants/colors/colors';
import {heightDP} from '@utils/responsive';

/**
 * Alto de la barra inferior. Estaba en heightDP(15) — un 15% de la pantalla,
 * unos 128dp en un teléfono normal, más del doble de lo habitual — y el FAB
 * de 70dp sobresalía tanto que tapaba el final del contenido en todas las
 * pestañas. Se exporta porque `router.tsx` lo necesita para colocar el FAB.
 */
export const TAB_BAR_HEIGHT = heightDP(9);

export const FAB_SIZE = 70;
/**
 * Cuánto sobresale el FAB por encima del borde superior de la barra.
 *
 * Ajustado a ojo NO, medido: con 24 el círculo asomaba 88px (32dp) por
 * encima del borde de la barra en el emulador, o sea solo un 54% del
 * círculo quedaba dentro. El objetivo son 3/4 dentro, es decir sobresalir
 * 1/4 de los 70dp de diámetro ≈ 18dp.
 *
 * Ojo con la aritmética: lo que se mide en pantalla NO es este valor.
 * `bottom` se cuenta desde el contenedor de la barra, que a su vez está
 * por encima del área de gestos, así que la parte visible que asoma sale
 * unos 8dp mayor que este número. De ahí el 10 y no el 18.
 */
export const FAB_OVERHANG = 10;

/**
 * Used to read `@redshank/native`'s `useTheme()` (`ThemeProvider`'s
 * `themeLight.colors` override) — `primary`/`secondary`/`inactive`
 * below are that same 1:1 migration to `@constants/colors/colors`,
 * verified hex-for-hex rather than assumed from the similarly-named
 * token in this file (`colors.secondary`/`colors.inactive` mean
 * DIFFERENT colors than `themeLight.colors.secondary`/`.inactive`
 * did): `themeLight.colors.primary` (`#010062`) is `tokens.primary[0]`,
 * `.secondary` (`#8CC63F`) is `tokens.accent[1]`, `.inactive`
 * (`#5CA41B`) is `tokens.accent[2]`.
 */
/**
 * `bottomInset` es el alto de la barra de navegacion del sistema.
 *
 * Desde targetSdk 35, Android 15+ dibuja la app de borde a borde y desde
 * targetSdk 36 ya no se puede desactivar: la ventana llega hasta el borde
 * inferior y los botones del sistema (atras / inicio / recientes) se pintan
 * ENCIMA de lo que haya ahi. Con `height` fijo y `paddingBottom: 0` esta
 * barra quedaba debajo de esos botones, tapando las etiquetas y robando
 * los toques. Lo reportaron los verificadores de la prueba cerrada y se
 * reprodujo en el emulador (Android 16, navegacion de tres botones).
 *
 * `paddingBottom` y `height` se fijan aqui a mano porque cualquier valor
 * en `tabBarStyle` reemplaza el padding que React Navigation calcula solo.
 * El FAB no se mueve: se posiciona dentro de la fila de pestanas, que va
 * por encima del padding, asi que su `bottom` sigue contando igual.
 */
export const bottomTabNavScreenOptions = (
  bottomInset: number,
): BottomTabNavigationOptions => ({
  headerShown: false,
  tabBarHideOnKeyboard: true,
  tabBarStyle: {
    backgroundColor: colors[primary][0],
    borderTopRightRadius: 50,
    borderTopLeftRadius: 50,
    height: TAB_BAR_HEIGHT + bottomInset,
    paddingBottom: bottomInset,
  },
  tabBarActiveTintColor: colors[accent][1],
  tabBarInactiveTintColor: colors[accent][2],
  tabBarActiveBackgroundColor: `${colors[accent][1]}33`,
  tabBarItemStyle: {
    borderRadius: 50,
    marginVertical: 6,
    paddingVertical: 4,
  },
  tabBarIconStyle: {
    marginTop: 0,
  },
});
