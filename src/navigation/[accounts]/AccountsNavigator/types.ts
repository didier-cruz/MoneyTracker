import {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type AccountsNavParams = {
  Accounts: undefined;
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
  'Accounts'
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
