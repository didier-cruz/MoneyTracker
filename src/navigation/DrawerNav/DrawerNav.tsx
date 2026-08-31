import {createDrawerNavigator} from '@react-navigation/drawer';
import {drawerRouter} from './router';
import CustomDrawer from './CustomDrawer';
import {drawerNavScreenOptions} from './navOptions';

const Drawer = createDrawerNavigator();

export const DrawerNav = () => {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawer {...props} />}
      screenOptions={drawerNavScreenOptions()}>
      {drawerRouter.map(({name, component, options}, index) => (
        <Drawer.Screen
          key={name + index}
          name={name}
          component={component}
          options={options}
        />
      ))}
    </Drawer.Navigator>
  );
};
