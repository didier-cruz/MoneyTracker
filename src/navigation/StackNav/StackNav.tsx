import {createStackNavigator} from '@react-navigation/stack';
import {DashboardScreen} from '@screens/DashboardScreen';
import {FormScreen} from '@screens/FormScreen';
import {CreateCategory} from '@screens/[categories]';
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
      {/* El boton "Mas categorias" del formulario abre DIRECTAMENTE el
          alta. Antes abria el listado de categorias, un desvio: en ese
          momento el usuario ya sabe que le falta una categoria, no
          quiere navegar las que tiene. Administrar categorias vive
          ahora en el menu lateral, y recorrer sus movimientos en la
          pestana Movimientos > Categorias. */}
      <Stack.Screen name="CreateCategory" component={CreateCategory} />
    </Stack.Navigator>
  );
};
