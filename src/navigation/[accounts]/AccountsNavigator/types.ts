import {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type AccountsNavParams = {
  /**
   * La pantalla raiz de este stack. NO puede llamarse `Accounts`: asi se
   * llama tambien la pestana que lo contiene, y react-navigation avisa de
   * pantallas homonimas anidadas (`Home > RootNav > Accounts > Accounts`),
   * que hace ambiguo a que ruta apunta un `navigate('Accounts')`.
   */
  AccountsHome: undefined;
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
};

export type AccountsNavigationProp = NativeStackNavigationProp<
  AccountsNavParams,
  'AccountsHome'
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
