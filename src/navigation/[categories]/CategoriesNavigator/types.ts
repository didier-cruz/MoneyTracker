import {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type CategoriesNavParams = {
  CategoriesTopTabsNavigation: undefined;
  CreateCategory: undefined;
  /** Misma pantalla que `CreateCategory`, en modo edicion — mismo patron
   * que `CreateAccount`/`EditAccount` y `CreateEnvelope`/`EditEnvelope`. */
  EditCategory: {categoryId: number};
};

export type CreateCategoryNavigationProp = NativeStackNavigationProp<
  CategoriesNavParams,
  'CreateCategory'
>;
