import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {MovementsTopTabs} from '@navigation/[movements]/MovementsTopTabs';
import {CreateCategory} from '@screens/[categories]';
import {CreateAccount} from '@screens/AccountsScreen/CreateAccount';
import {Transfer} from '@screens/AccountsScreen/Transfer';
import {AccountsNavParams} from './types';

const Stack = createNativeStackNavigator<AccountsNavParams>();

/**
 * El stack de la pestana MOVIMIENTOS.
 *
 * Su raiz ya no es `AccountsScreen` sino `MovementsTopTabs`, las dos
 * pestanas Cuentas|Categorias: son dos formas de recorrer los mismos
 * movimientos —por cuenta o por categoria— y antes la segunda solo se
 * alcanzaba desde el formulario de nuevo movimiento, es decir habia que
 * empezar a registrar un gasto para poder navegar los gastos.
 *
 * Las pestanas viven en la RAIZ y no envolviendo este stack a
 * proposito: asi todo lo que se empuja desde ellas —Transferir, Crear
 * cuenta, Crear categoria— cubre la pantalla completa en vez de
 * pintarse dentro del area de una pestana con la fila de pestanas
 * encima. Ver el comentario de `MovementsTopTabs`.
 *
 * `CreateCategory`/`EditCategory` se registran aqui, ademas de en el
 * stack del formulario y en el del menu lateral: cada stack necesita su
 * propia copia para poder empujarla sobre si mismo. Es el mismo
 * componente en los tres sitios.
 *
 * Original:
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
      <Stack.Screen name="MovementsHome" component={MovementsTopTabs} />
      {/* Solo el ALTA: editar y ver archivadas se administran desde el
          menu lateral (`AccountsAdminNavigator`), asi que sus rutas ya
          no se alcanzan desde aqui y tenerlas registradas seria dejar
          dos rutas muertas. El alta se queda porque la tarjeta
          "Agregar cuenta" de la lista horizontal la sigue empujando. */}
      <Stack.Screen name="CreateAccount" component={CreateAccount} />
      <Stack.Screen name="Transfer" component={Transfer} />
      <Stack.Screen name="CreateCategory" component={CreateCategory} />
      <Stack.Screen name="EditCategory" component={CreateCategory} />
    </Stack.Navigator>
  );
};
