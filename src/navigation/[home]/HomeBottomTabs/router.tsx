import {StackNav} from '@navigation/StackNav';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faHome} from '@fortawesome/free-solid-svg-icons/faHome';
// import {fixedExpenses} from '@data/fixedExpenses';
import {faLayerGroup} from '@fortawesome/free-solid-svg-icons/faLayerGroup';
import {faPlusCircle} from '@fortawesome/free-solid-svg-icons/faPlusCircle';
import {faPiggyBank} from '@fortawesome/free-solid-svg-icons/faPiggyBank';
import {faChartPie} from '@fortawesome/free-solid-svg-icons/faChartPie';
// import {varOutcomes} from '@data/varOutcomes';
// import {incomes} from '@data/incomes';
import {accent, colors} from '@constants/colors/colors';
import {StyleSheet, TouchableOpacity} from 'react-native';
import {FAB_OVERHANG, FAB_SIZE, TAB_BAR_HEIGHT} from './navOptions';
import {useTranslation} from 'react-i18next';
import Resumen from '@screens/ResumenScreen';
import {AccountsNavigator} from '@navigation/[accounts]/AccountsNavigator';
import {BudgetsNavigator} from '@navigation/[budgets]/BudgetsNavigator';
import AnalysisScreen from '@screens/AnalysisScreen';

/**
 * Bottom-tab routes as a HOOK (not a static exported array) — the
 * route `name`s below are IDENTIFIERS and never change with the
 * language (same reasoning as `drawerRouter`'s own comment: renaming a
 * route out from under `navigation.navigate(...)` would break it), but
 * `options.title` IS the visible tab label, and `title` is a plain
 * string, not a render-prop function like `drawerLabel` — so unlike
 * the drawer, there is no way to keep it reactive by wrapping it in a
 * small translated component. Recomputing this whole array from a
 * hook that calls `useTranslation()` is what makes these labels update
 * immediately when the language switch flips: `HomeBottomTabs` calls
 * this on every render, and `useTranslation()` forces that render to
 * happen when `i18n.language` changes.
 */
export const useBottomTabsRoutes = (): IBottomTab[] => {
  const {t} = useTranslation();

  return [
    {
      name: 'Resumen',
      component: Resumen,
      initialParams: {category: 'incomes'},
      options: {
        title: t('resumen.title'),
        tabBarIcon: ({color, size}) => (
          <FontAwesomeIcon icon={faHome} color={color} size={size} />
        ),
      },
    },
    {
      name: 'Accounts',
      component: AccountsNavigator,
      initialParams: {category: 'fixedExpenses'},
      options: {
        title: t('accounts.title'),
        tabBarIcon: ({color, size}) => (
          <FontAwesomeIcon icon={faLayerGroup} color={color} size={size} />
        ),
      },
    },
    {
      name: 'Outcomes',
      component: StackNav,
      options: {
        title: '',
        tabBarIcon: () => (
          <FontAwesomeIcon
            icon={faPlusCircle}
            color={colors[accent][2]}
            size={70}
            style={{
              zIndex: 1,
              // bottom: 43,
              backgroundColor: colors[accent][0],
              borderRadius: 50,
            }}
          />
        ),
        tabBarItemStyle: {},
        tabBarIconStyle: {},
        tabBarButton: ({onPress, children}) => {
          return (
            <TouchableOpacity
              style={fabStyles.button}
              onPress={onPress}>
              {children}
            </TouchableOpacity>
          );
        },
      },
    },
    {
      name: 'Budgets',
      component: BudgetsNavigator,
      options: {
        title: t('budgets.title'),
        tabBarIcon: ({color, size}) => (
          <FontAwesomeIcon icon={faPiggyBank} color={color} size={size} />
        ),
      },
    },
    {
      name: 'AnalysisScreen',
      component: AnalysisScreen,
      initialParams: {category: 'varOutcomes'},
      options: {
        title: t('analysis.title'),
        tabBarIcon: ({color, size}) => (
          <FontAwesomeIcon icon={faChartPie} color={color} size={size} />
        ),
      },
    },
  ];
};

const fabStyles = StyleSheet.create({
  /**
   * `left: '43%'` era una aproximación fija: solo quedaba centrado en el
   * ancho concreto donde se ajustó y se descuadraba en cualquier otro.
   * `left: '50%'` con un margen negativo de media anchura centra de verdad,
   * sea cual sea el dispositivo.
   */
  button: {
    position: 'absolute',
    left: '50%',
    marginLeft: -FAB_SIZE / 2,
    bottom: TAB_BAR_HEIGHT - FAB_SIZE + FAB_OVERHANG,
    width: FAB_SIZE,
    height: FAB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
