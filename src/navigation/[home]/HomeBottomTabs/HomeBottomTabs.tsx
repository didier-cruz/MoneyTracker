import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useBottomTabsRoutes} from './router';
import {bottomTabNavScreenOptions} from './navOptions';
import {useTheme} from '@redshank/native';

const Tab = createBottomTabNavigator();

export const HomeBottomTabs = () => {
  const {colors} = useTheme();
  const bottomTabsRoutes = useBottomTabsRoutes();

  return (
    <Tab.Navigator screenOptions={bottomTabNavScreenOptions(colors)}>
      {bottomTabsRoutes.map(
        ({name, component, initialParams, options}, index) => (
          <Tab.Screen
            key={name + index}
            name={name}
            component={component}
            initialParams={initialParams}
            options={options}
          />
        ),
      )}
    </Tab.Navigator>
  );
};
