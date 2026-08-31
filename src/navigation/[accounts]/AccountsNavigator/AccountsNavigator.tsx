import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AccountsScreen from '@screens/AccountsScreen';
import {CreateAccount} from '@screens/AccountsScreen/CreateAccount';
import {ArchivedAccounts} from '@screens/AccountsScreen/ArchivedAccounts';
import {Transfer} from '@screens/AccountsScreen/Transfer';
import {AccountsNavParams} from './types';

const Stack = createNativeStackNavigator<AccountsNavParams>();

/**
 * Wraps `AccountsScreen` in its own native stack so it can push
 * `CreateAccount` — `AccountsScreen` used to be registered directly as
 * a bottom-tab screen component (no stack of its own); see
 * `src/navigation/[home]/HomeBottomTabs/router.tsx`, which now points
 * the `Accounts` tab at this navigator instead.
 *
 * `EditAccount` reuses the exact same `CreateAccount` component
 * (`accountId` route param switches it into edit mode) rather than a
 * second screen — see `CreateAccount`'s doc comment. `ArchivedAccounts`
 * is a separate, read-only screen (no matching create/edit form to
 * reuse) — see its own doc comment for why it's read-only.
 *
 * `Transfer` (slice B3) is registered here, not on the bottom tabs'
 * "New movement" stack (`StackNav`/`FormScreen`) — the approved
 * prototype for that screen only has an expense/income segment, no
 * drawn entry point for a transfer. A transfer only ever moves money
 * between two of the user's own ACCOUNTS (never touches a category),
 * so this navigator — already the home for every other account-scoped
 * flow (create/edit/archive/view-archived) — is the more coherent
 * place for it than reaching into the untouched "New movement" prototype
 * or the tab bar (`navOptions.ts`, explicitly out of scope this slice).
 * See `AccountsScreen`'s own doc comment for where the entry point is.
 */
export const AccountsNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="AccountsHome" component={AccountsScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccount} />
      <Stack.Screen name="EditAccount" component={CreateAccount} />
      <Stack.Screen name="ArchivedAccounts" component={ArchivedAccounts} />
      <Stack.Screen name="Transfer" component={Transfer} />
    </Stack.Navigator>
  );
};
