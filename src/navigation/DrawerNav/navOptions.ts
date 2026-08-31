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
