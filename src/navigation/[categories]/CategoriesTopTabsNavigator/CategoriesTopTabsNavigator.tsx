import {View} from 'react-native';

import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
// TODO(slice B): wire `categoriesTopTabsRouter` (./router) into Tab.Navigator via
// map() instead of the hardcoded <Tab.Screen> pair below — router.tsx already
// defines the same Expenses/Incomes tabs but nothing consumes it yet.
import {colors, primary} from '@constants/colors/colors';
import {useTheme} from '@redshank/native';
import {useTranslation} from 'react-i18next';
import Header from '@screens/[categories]/components/Header/Header';
import {CategoriesScreen} from '@screens/[categories]';
import {CategoriesTopTabsNavigatorParams} from './types';

const Tab = createMaterialTopTabNavigator<CategoriesTopTabsNavigatorParams>();

export const CategoriesTopTabsNavigator = () => {
  const {colors: colorTheme} = useTheme();
  const {t} = useTranslation();
  return (
    <>
      <View style={{paddingHorizontal: 15}}>
        <Header title={t('categories.listCategoriesTitle')} />
      </View>
      <Tab.Navigator
        tabBarPosition="bottom"
        screenOptions={{
          tabBarActiveTintColor: colorTheme.accent,
          tabBarInactiveTintColor: colorTheme.secondary,
          //   tabBarActiveBackgroundColor: `${colors.secondary}33`,
          //   tabBarPressColor: `${colorTheme.secondary}33`,
          tabBarLabelStyle: {fontSize: 12, fontWeight: '900'},
          //   tabBarItemStyle: {width: 100},

          tabBarStyle: {
            position: 'relative',
            justifyContent: 'center',
            alignSelf: 'center',
            backgroundColor: colors[primary][0],
            elevation: 0,
            width: '100%',
            height: 50,
            borderTopRightRadius: 30,
            borderTopLeftRadius: 30,
          },
          tabBarItemStyle: {
            // backgroundColor: 'red',
            // borderRadius: 15,
          },
          tabBarContentContainerStyle: {
            // backgroundColor: 'red',
          },
          tabBarIndicatorStyle: {
            backgroundColor: `${colorTheme.secondary}33`,
            height: 50,
            borderTopRightRadius: 30,
            borderTopLeftRadius: 30,
            // opacity: 0.3,
            // display: 'none',
          },
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
