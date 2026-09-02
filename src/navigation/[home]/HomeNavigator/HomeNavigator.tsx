import {HomeBottomTabs} from '@navigation/[home]/HomeBottomTabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AllMovementsScreen} from '@screens/AllMovementsScreen';
import {HomeNavParams} from './types';

const Stack = createNativeStackNavigator<HomeNavParams>();

/**
 * El stack que envuelve a las pestanas.
 *
 * `AllMovements` se registra AQUI y no dentro de una pestana: al vivir
 * por encima del navegador de pestanas, empujarla cubre la pantalla
 * entera —barra inferior incluida—, que es lo que corresponde a una
 * vista de consulta completa. Registrada dentro de una pestana se
 * pintaria en el area de esa pestana, con la barra inferior debajo
 * sugiriendo que sigues "dentro" de ella.
 */
export const HomeNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="RootNav" component={HomeBottomTabs} />
      <Stack.Screen name="AllMovements" component={AllMovementsScreen} />
    </Stack.Navigator>
  );
};
