import {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type AccountsNavParams = {
  /**
   * La raiz de este stack: las pestanas Cuentas|Categorias. NO puede
   * llamarse igual que la pestana que lo contiene ni que sus propias
   * pestanas — react-navigation avisa de pantallas homonimas anidadas y
   * hace ambiguo a que ruta apunta un `navigate(...)`. De ahi la cadena
   * `Movements > MovementsHome > AccountsTab`.
   */
  MovementsHome: undefined;
  CreateAccount: undefined;
  /** Same screen component as `CreateAccount`, in edit mode — see
   * `CreateAccount`'s doc comment. */
  EditAccount: {accountId: number};
  ArchivedAccounts: undefined;
  /** Move money between two of the user's own accounts — see
   * `src/screens/AccountsScreen/Transfer/Transfer.tsx`'s doc comment for
   * why it lives in this navigator (no entry for it in the approved
   * "New movement" prototype). */
  Transfer: undefined;
  /** Crear/editar categoria empujadas desde la pestana de categorias
   * — ver el comentario del navegador. */
  CreateCategory: undefined;
  EditCategory: {categoryId: number};
};

export type AccountsNavigationProp = NativeStackNavigationProp<
  AccountsNavParams,
  'MovementsHome'
>;

export type CreateAccountNavigationProp = NativeStackNavigationProp<
  AccountsNavParams,
  'CreateAccount'
>;

export type EditAccountNavigationProp = NativeStackNavigationProp<
  AccountsNavParams,
  'EditAccount'
>;

export type ArchivedAccountsNavigationProp = NativeStackNavigationProp<
  AccountsNavParams,
  'ArchivedAccounts'
>;

export type TransferNavigationProp = NativeStackNavigationProp<
  AccountsNavParams,
  'Transfer'
>;
