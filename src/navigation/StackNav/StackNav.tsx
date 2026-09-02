import {createStackNavigator} from '@react-navigation/stack';
import {DashboardScreen} from '@screens/DashboardScreen';
import {FormScreen} from '@screens/FormScreen';
import {CategoriesNavigator} from '@navigation/[categories]/CategoriesNavigator/CategoriesNavigator';
import {StackNavParams} from './types';

const Stack = createStackNavigator<StackNavParams>();

export const StackNav = () => {
  return (
    <Stack.Navigator
      initialRouteName="Form"
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: '',
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="Form"
        component={FormScreen}
        options={{
          title: '',
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="EditTransaction"
        component={FormScreen}
        options={{
          title: '',
          animation: 'none',
        }}
      />
      <Stack.Screen name="Categories" component={CategoriesNavigator} />
    </Stack.Navigator>
  );
};
