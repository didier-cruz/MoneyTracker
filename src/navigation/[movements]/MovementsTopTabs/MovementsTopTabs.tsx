import {StyleSheet, View} from 'react-native';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {useTranslation} from 'react-i18next';

import {MainHeader} from '@components/molecules/Headers/MainHeader';
import {accent, colors, gray, white} from '@constants/colors/colors';
import AccountsScreen from '@screens/AccountsScreen';
import {CategoriesScreen} from '@screens/[categories]';
import {MovementsTopTabsParams} from './types';

const Tab = createMaterialTopTabNavigator<MovementsTopTabsParams>();

const SCREEN_HORIZONTAL_PADDING = 15;
// Mismo neutro de una sola vez que usan `SegmentedControl`, `ChipSelect`
// y `TypeSegment` para su carril inactivo.
const TRACK_BG = '#EDEDF2';
const TRACK_RADIUS = 14;

/**
 * Las dos formas de recorrer los mismos movimientos: por CUENTA o por
 * CATEGORIA.
 *
 * Vive DENTRO de la pantalla raiz del stack de Movimientos, no
 * envolviendolo. Si envolviera el stack, al empujar Transferir, Crear
 * cuenta o Cuentas archivadas esas pantallas se pintarian dentro del
 * area de la pestana, con la fila de pestanas encima: media pantalla
 * seria una pantalla completa y la otra mitad navegacion que ya no
 * aplica. Asi las pestanas solo existen en la raiz y todo lo que se
 * empuja cubre la pantalla entera.
 *
 * La anatomia es la de `SegmentedControl` —carril claro, pastilla
 * blanca para la activa— igual que las pestanas Gastos/Ingresos de
 * categorias: es como esta app resuelve elegir entre dos opciones.
 *
 * El encabezado (titulo + boton del menu lateral) se pinta AQUI, una
 * sola vez y ENCIMA de las pestanas. Dejarlo dentro de cada pestana lo
 * ponia debajo de la fila de pestanas —el titulo de la pantalla por
 * debajo de su propia navegacion— y ademas obligaba a repetirlo: la
 * vista de cuentas traia el suyo y la de categorias se quedaba sin
 * ninguno, con lo que el boton del menu lateral desaparecia en esa
 * mitad. Con un solo encabezado, la etiqueta de la pestana ya dice cual
 * de las dos se esta viendo, asi que el titulo no lo repite.
 */
export const MovementsTopTabs = () => {
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      <MainHeader title={t('movements.title')} />
      <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors[accent][2],
        tabBarInactiveTintColor: colors[gray][0],
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.track,
        tabBarIndicatorStyle: styles.indicator,
        tabBarItemStyle: styles.item,
      }}>
        <Tab.Screen
          name="AccountsTab"
          component={AccountsScreen}
          options={{tabBarLabel: t('accounts.tabLabel')}}
        />
        <Tab.Screen
          name="CategoriesTab"
          component={CategoriesScreen}
          options={{tabBarLabel: t('categories.tabLabel')}}
        />
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  track: {
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: TRACK_BG,
    borderRadius: TRACK_RADIUS,
    elevation: 0,
    shadowOpacity: 0,
    overflow: 'hidden',
  },
  item: {
    paddingVertical: 12,
    minHeight: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'none',
    margin: 0,
  },
  indicator: {
    height: '100%',
    borderRadius: TRACK_RADIUS,
    backgroundColor: colors[white][0],
  },
});

export default MovementsTopTabs;
