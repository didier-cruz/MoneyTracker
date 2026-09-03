import {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type AccountsAdminNavParams = {
  /** Raiz. Nombre propio para no repetir el de la ruta del menu lateral
   * que contiene este stack. */
  AccountsAdminHome: undefined;
  CreateAccount: undefined;
  EditAccount: {accountId: number};
  ArchivedAccounts: undefined;
};

export type AccountsAdminNavigationProp = NativeStackNavigationProp<
  AccountsAdminNavParams,
  'AccountsAdminHome'
>;
