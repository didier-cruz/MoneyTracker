import {createNativeStackNavigator} from '@react-navigation/native-stack';
import BudgetsScreen from '@screens/BudgetsScreen';
import {CreateEnvelope} from '@screens/BudgetsScreen/CreateEnvelope';
import {BudgetsNavParams} from './types';

const Stack = createNativeStackNavigator<BudgetsNavParams>();

/**
 * Wraps `BudgetsScreen` in its own native stack so it can push
 * `CreateEnvelope` — same shape as `AccountsNavigator` wrapping
 * `AccountsScreen` (see that navigator's doc comment). Registered in
 * `src/navigation/[home]/HomeBottomTabs/router.tsx`'s `Budgets` tab in
 * place of the bare `BudgetsScreen` component it used to point at
 * directly.
 *
 * `EditEnvelope` reuses the exact same `CreateEnvelope` component
 * (`envelopeId` route param switches it into edit mode) rather than a
 * second screen — see `CreateEnvelope`'s doc comment. Assigning to /
 * withdrawing from an envelope, and setting a category's monthly
 * limit, are NOT separate routes — both are bottom-sheet modals owned
 * by `BudgetsScreen` itself (see that screen's doc comment for why),
 * so there is nothing else to register here.
 */
export const BudgetsNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="BudgetsHome" component={BudgetsScreen} />
      <Stack.Screen name="CreateEnvelope" component={CreateEnvelope} />
      <Stack.Screen name="EditEnvelope" component={CreateEnvelope} />
    </Stack.Navigator>
  );
};
