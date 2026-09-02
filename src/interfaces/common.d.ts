import {DrawerNavigationOptions} from '@react-navigation/drawer';
import {NativeStackNavigationOptions} from '@react-navigation/native-stack';
import {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs';
import {MaterialTopTabNavigationOptions} from '@react-navigation/material-top-tabs';
import {ViewStyle} from 'react-native';

declare global {
  interface ScreenInterface {
    name: string;
    component: ScreenComponentType<ParamListBase, string>;
    initialParams?: Object;
  }
  interface INativeStack extends ScreenInterface {
    options?: NativeStackNavigationOptions;
  }
  interface IDrawer extends ScreenInterface {
    options?: DrawerNavigationOptions;
  }
  interface IBottomTab extends ScreenInterface {
    options?: BottomTabNavigationOptions;
  }

  interface IMaterialTopTab extends ScreenInterface {
    options?: MaterialTopTabNavigationOptions;
  }

  interface SelectOptions {
    value: string;
    label: string;
  }
  interface ChartItem {
    value: number;
    color: string;
    text?: string;
    focused?: boolean;
  }
  interface TransactItem {
    /** A `react-native-vector-icons/FontAwesome` icon NAME — real
     * category/account data, e.g. `category.icon` from `@db/queries`
     * (or a neutral fallback like `'exchange'` for a transfer leg, see
     * `ResumenScreen/mappers.ts`). Previously also accepted a
     * `@fortawesome/react-native-fontawesome` icon DEFINITION object for
     * this screen's now-deleted static mocks — every consumer is real
     * data now, so this is a single string-only path (slice B4). */
    icon: string;
    category: string;
    /** SIGNED integer cents — negative colors/arrows the row as an
     * outflow, positive as an inflow. Never a float; never dollars. */
    amount: number;
    date: string;
    color: string;
    /** Stable row id (finance row id) for list keys. Optional because
     * a caller building a one-off row (not from a keyed list) has no
     * need for one. */
    id?: number;
    /** Overrides `TransactItem`'s own fixed row height (90) — additive,
     * every existing caller omits it and keeps that default. Added for
     * `ResumenScreen`'s "Movements" preview card, whose approved
     * prototype calls for a shorter 82pt row; changing the shared
     * default outright would also reflow `AccountsScreen`'s per-account
     * list (out of this slice's scope), so this is opt-in per caller
     * instead. */
    containerStyle?: ViewStyle;
    /** Abre el menu de administrar el movimiento (editar / eliminar).
     * Opcional: sin el, la fila no es pulsable — ver `TransactItem`. */
    onLongPress?: () => void;
  }
  interface CatalogCard {
    id: number;
    /** A `react-native-vector-icons/FontAwesome` icon name — matches
     * `IAccount.icon`'s free-form string convention from `@db/queries`. */
    icon: string;
    iconColor: string;
    iconBackground: string;
    field: string;
    /** SIGNED integer cents. Never a float. */
    balance: number;
    selectedId?: number;
    onPress?: () => void;
    /** Opens the "manage this account" menu (edit / archive) — omitted
     * (no button rendered) for the `'add'` variant and whenever the
     * caller has nothing to manage (e.g. a future non-account consumer
     * of this same card). Not in the approved prototype (there isn't
     * one yet for this screen); see `AccountsScreen`'s HANDOFF note. */
    onPressManage?: () => void;
    /** `'square'` (default) — the 150x150 account card. `'wide'` — the
     * receivable-account card (per the approved prototype). `'add'` —
     * the trailing "create account" affordance (not in the approved
     * prototype; see `AccountsScreen`'s HANDOFF note). */
    variant?: 'square' | 'wide' | 'add';
  }

  type SectionTransactItem = {
    date: string;
    data: TransactItem[];
  };

  type CatalogList = {
    data: CatalogCard[];
    selectedId: number;
    onPressItem: (id: number) => void;
    /** Per-item "manage" callback — see `CatalogCard.onPressManage`.
     * Optional so `CatalogList`'s existing behavior (no manage
     * affordance) is unchanged for callers that don't pass it. */
    onPressManageItem?: (id: number) => void;
  };

  type FinanceType = 'expenses' | 'incomes';
  interface IIcon {
    id: number;
    icon: string;
  }
  interface ICategory extends IIcon {
    name: string;
    type: 'income' | 'expense';
  }
}
