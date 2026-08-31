import {ReactElement} from 'react'
import {RefreshControlProps, ViewStyle} from 'react-native/types'
export interface ScrollContainerProps {
  children: JSX.Element | JSX.Element[];
  style?: ViewStyle;
  /**
   * Passed straight through to the underlying `FlatList`
   * `ScrollView` (itself a `FlatList` under the hood — see that
   * library's own `ScrollView/index.js` — which natively accepts a
   * `refreshControl` element same as RN's own `ScrollView`/`FlatList`).
   * Optional/additive: `BudgetsScreen` is the first `ScreenTemplate`
   * caller that needs pull-to-refresh on non-list content; every
   * existing caller that never passes this keeps its current
   * non-refreshable behavior.
   */
  refreshControl?: ReactElement<RefreshControlProps>;
}