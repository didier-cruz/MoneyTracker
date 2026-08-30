import {CategoriesScreen} from '@screens/[categories]';

export const categoriesTopTabsRouter: IMaterialTopTab[] = [
  {
    name: 'Expenses',
    component: CategoriesScreen,
    initialParams: {
      financeType: 'expenses',
    },
    options: {
      tabBarLabel: 'Expenses',
    },
  },
  {
    name: 'Incomes',
    component: CategoriesScreen,
    initialParams: {
      financeType: 'incomes',
    },
    options: {
      tabBarLabel: 'Incomes',
    },
  },
];
