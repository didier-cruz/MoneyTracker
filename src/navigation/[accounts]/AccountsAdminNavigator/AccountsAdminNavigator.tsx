import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AccountsAdminScreen} from '@screens/AccountsScreen/AccountsAdminScreen';
import {CreateAccount} from '@screens/AccountsScreen/CreateAccount';
import {ArchivedAccounts} from '@screens/AccountsScreen/ArchivedAccounts';
import {AccountsAdminNavParams} from './types';

const Stack = createNativeStackNavigator<AccountsAdminNavParams>();

/**
 * Administrar cuentas, colgado del menu lateral — hermano de
 * `CategoriesAdminNavigator` y con el mismo reparto: las pestanas para
 * recorrer movimientos, el menu lateral para mantener el catalogo.
 *
 * `CreateAccount` es el mismo componente que registra el stack de
 * Movimientos; cada stack necesita su propia copia para poder empujarla
 * sobre si mismo.
 */
export const AccountsAdminNavigator = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="AccountsAdminHome" component={AccountsAdminScreen} />
    <Stack.Screen name="CreateAccount" component={CreateAccount} />
    <Stack.Screen name="EditAccount" component={CreateAccount} />
    <Stack.Screen name="ArchivedAccounts" component={ArchivedAccounts} />
  </Stack.Navigator>
);

export default AccountsAdminNavigator;
