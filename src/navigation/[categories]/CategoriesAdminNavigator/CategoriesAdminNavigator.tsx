import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {CategoriesAdminScreen, CreateCategory} from '@screens/[categories]';
import {CategoriesAdminNavParams} from './types';

const Stack = createNativeStackNavigator<CategoriesAdminNavParams>();

/**
 * Administrar categorias, colgado del menu lateral.
 *
 * Es un stack propio y no una pantalla suelta porque crear y editar son
 * pantallas completas que se empujan sobre el listado. `CreateCategory`
 * es el mismo componente que usan el stack de Movimientos y el del
 * formulario: cada stack necesita su propia copia registrada para poder
 * empujarla sobre si mismo.
 */
export const CategoriesAdminNavigator = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="CategoriesAdminHome" component={CategoriesAdminScreen} />
    <Stack.Screen name="CreateCategory" component={CreateCategory} />
    <Stack.Screen name="EditCategory" component={CreateCategory} />
  </Stack.Navigator>
);

export default CategoriesAdminNavigator;
