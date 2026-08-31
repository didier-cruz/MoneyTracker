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

/** Cuánto sobresale el FAB por encima del borde superior de la barra. */
export const FAB_SIZE = 70;
export const FAB_OVERHANG = 24;

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
export const bottomTabNavScreenOptions = (): BottomTabNavigationOptions => ({
  headerShown: false,
  tabBarHideOnKeyboard: true,
  tabBarStyle: {
    backgroundColor: colors[primary][0],
    borderTopRightRadius: 50,
    borderTopLeftRadius: 50,
    height: TAB_BAR_HEIGHT,
    paddingBottom: 0,
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
