import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useBottomTabsRoutes} from './router';
import {bottomTabNavScreenOptions} from './navOptions';
import {TabBarLabel} from './TabBarLabel';

const Tab = createBottomTabNavigator();

const renderTabBarLabel: BottomTabNavigationOptions['tabBarLabel'] = ({
  color,
  children,
}) => <TabBarLabel color={color}>{children}</TabBarLabel>;

export const HomeBottomTabs = () => {
  const bottomTabsRoutes = useBottomTabsRoutes();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        ...bottomTabNavScreenOptions(insets.bottom),
        tabBarLabel: renderTabBarLabel,
      }}>
      {bottomTabsRoutes.map(
        ({name, component, initialParams, options, listeners}, index) => (
          <Tab.Screen
            key={name + index}
            name={name}
            component={component}
            initialParams={initialParams}
            options={options}
            listeners={listeners}
          />
        ),
      )}
    </Tab.Navigator>
  );
};
