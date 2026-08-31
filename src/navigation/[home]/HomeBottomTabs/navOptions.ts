import {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs';
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

type BottomTabNavType = (colors: any) => BottomTabNavigationOptions;

export const bottomTabNavScreenOptions: BottomTabNavType = (colors: any) => ({
  headerShown: false,
  tabBarHideOnKeyboard: true,
  tabBarStyle: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 50,
    borderTopLeftRadius: 50,
    height: TAB_BAR_HEIGHT,
    paddingBottom: 0,
  },
  tabBarActiveTintColor: colors.secondary,
  tabBarInactiveTintColor: colors.inactive,
  tabBarActiveBackgroundColor: `${colors.secondary}33`,
  tabBarItemStyle: {
    borderRadius: 50,
    marginVertical: 6,
    paddingVertical: 4,
  },
  tabBarIconStyle: {
    marginTop: 0,
  },
});
