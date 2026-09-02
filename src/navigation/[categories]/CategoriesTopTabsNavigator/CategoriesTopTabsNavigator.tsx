import {StyleSheet, View} from 'react-native';

import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
// TODO(slice B): wire `categoriesTopTabsRouter` (./router) into Tab.Navigator via
// map() instead of the hardcoded <Tab.Screen> pair below — router.tsx already
// defines the same Expenses/Incomes tabs but nothing consumes it yet.
import {accent, colors, gray, white} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';
import Header from '@screens/[categories]/components/Header/Header';
import {CategoriesScreen} from '@screens/[categories]';
import {CategoriesTopTabsNavigatorParams} from './types';

const Tab = createMaterialTopTabNavigator<CategoriesTopTabsNavigatorParams>();

const SCREEN_HORIZONTAL_PADDING = 15;
// Mismo neutro de una sola vez que usa `SegmentedControl` para su
// carril; no esta en `@constants/colors` porque solo lo piden estos dos
// controles. Duplicado a proposito antes que promoverlo a token por dos
// usos.
const TRACK_BG = '#EDEDF2';
const TRACK_RADIUS = 14;

/**
 * Gastos / Ingresos.
 *
 * Las pestanas estaban `tabBarPosition="bottom"`, pintadas como una
 * barra indigo con las esquinas superiores redondeadas: quedaban
 * encajadas contra la barra de navegacion de la app y partidas por el
 * boton flotante, que las tapa por el centro. Dos barras indigo
 * apiladas, ademas, no dejaban claro cual navegaba a donde.
 *
 * Ahora van ARRIBA, justo bajo el titulo, con la misma anatomia que
 * `SegmentedControl` —carril claro, pastilla blanca para la activa— que
 * es como esta app resuelve ya en todas partes elegir entre dos
 * opciones (tipo de movimiento, tipo de cuenta, Fondo/Deuda).
 *
 * El indicador hace de pastilla: ocupa todo el alto del carril con su
 * mismo radio, en vez de la linea fina por defecto. La altura del carril
 * NO se fija a mano —la marca el padding de cada pestana—: fijarla
 * recortaba las etiquetas por abajo, porque el contenido seguia midiendo
 * lo suyo y la barra lo cortaba.
 */
export const CategoriesTopTabsNavigator = () => {
  const {t} = useTranslation();
  return (
    <>
      <View style={styles.header}>
        <Header title={t('categories.listCategoriesTitle')} />
      </View>
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
          name="Expenses"
          component={CategoriesScreen}
          initialParams={{financeType: 'expenses'}}
          options={{
            tabBarLabel: t('categories.expenses'),
          }}
        />
        <Tab.Screen
          name="Incomes"
          component={CategoriesScreen}
          initialParams={{financeType: 'incomes'}}
          options={{
            tabBarLabel: t('categories.incomes'),
          }}
        />
      </Tab.Navigator>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  track: {
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginBottom: 10,
    backgroundColor: TRACK_BG,
    borderRadius: TRACK_RADIUS,
    // Sin esto la barra proyecta la sombra por defecto de Material y se
    // ve una linea gris bajo el carril.
    elevation: 0,
    shadowOpacity: 0,
    // Recorta la pastilla contra las esquinas redondeadas del carril.
    overflow: 'hidden',
  },
  item: {
    paddingVertical: 12,
    minHeight: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    // Los nombres son cortos ("Gastos", "Ingresos") y Material los pone
    // en mayusculas por defecto, que no es como escribe esta app.
    textTransform: 'none',
    // Material le pone margen propio, que sumado al padding de la
    // pestana descuadra el centrado vertical.
    margin: 0,
  },
  indicator: {
    height: '100%',
    borderRadius: TRACK_RADIUS,
    backgroundColor: colors[white][0],
  },
});
