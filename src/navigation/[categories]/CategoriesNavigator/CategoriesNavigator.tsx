import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {CategoriesTopTabsNavigator} from '../CategoriesTopTabsNavigator';
import {CreateCategory} from '@screens/[categories]';
import {CategoriesNavParams} from './types';

const Stack = createNativeStackNavigator<CategoriesNavParams>();

export const CategoriesNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CategoriesTopTabsNavigation"
        component={CategoriesTopTabsNavigator}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CreateCategory"
        component={CreateCategory}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EditCategory"
        component={CreateCategory}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};
