import {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type CategoriesAdminNavParams = {
  /** Raiz. No se llama `Categories` para no repetir el nombre de la
   * ruta del menu lateral que contiene este stack. */
  CategoriesAdminHome: undefined;
  CreateCategory: undefined;
  EditCategory: {categoryId: number};
};

export type CategoriesAdminNavigationProp = NativeStackNavigationProp<
  CategoriesAdminNavParams,
  'CategoriesAdminHome'
>;
