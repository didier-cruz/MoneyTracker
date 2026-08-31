import {FC, ReactNode} from 'react';
import {
  DimensionValue,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors, overlay, white} from '@constants/colors/colors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Caps the sheet's own height (e.g. `'70%'`, `'80%'`) so a caller
   * whose content can outgrow the screen — `AccountPickerModal`'s
   * account list, `CategoryLimitModal`'s category list — has a hard
   * ceiling instead of growing past it. Omit for content that's always
   * short and self-sizing (`ActionSheet`'s handful of rows,
   * `AssignWithdrawModal`'s single amount field).
   *
   * This ALONE does not make a tall child scrollable — see the
   * "one scroll region" note on `children` below, this is only the
   * ceiling that scroll region needs to have something to scroll
   * against.
   */
  maxHeight?: DimensionValue;
  /**
   * If `children` is (or contains) a `FlatList`/`ScrollView`, give
   * THAT list its own `style={{flexShrink: 1}}` (in addition to
   * whatever `maxHeight`/`style` it already needs) — React Native
   * defaults `flexShrink` to `0`, unlike web/Yoga's `1`, so without it
   * a tall list won't shrink to fit under this sheet's own `maxHeight`,
   * it will just overflow past the sheet's rounded edges instead of
   * scrolling. `body` below (the direct wrapper around `children`)
   * already carries `flexShrink: 1` itself so the chain isn't broken
   * above the list — this is the one piece only the list itself can
   * supply. See `AccountPickerModal`/`CategoryLimitModal` for the
   * pattern: title + list + (in `CategoryLimitModal`'s "add" mode)
   * footer fields ALL ride inside that one `FlatList` as its
   * header/footer, so it stays the sheet's ONLY scrollable region —
   * nesting a second independently-scrolling list/ScrollView inside a
   * sheet already built this way re-triggers the exact
   * "VirtualizedLists should never be nested inside plain ScrollViews"
   * warning this shape exists to avoid.
   */
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const HANDLE_BOTTOM_MARGIN = 12;
const PANEL_EXTRA_BOTTOM_PADDING = 8;

/**
 * Shared bottom-sheet chrome for `ActionSheet`, `CategoryLimitModal`,
 * `AssignWithdrawModal`, and `AccountPickerModal` — the `maxHeight`
 * prop and the `body` wrapper's `flexShrink: 1` (see `children`'s own
 * doc comment above) are exactly the two contracts those last three
 * needed that this component didn't originally expose; see the
 * `@redshank/native` removal slice's HANDOFF for why they were left on
 * their own hand-built shape until this extension landed.
 *
 * Uses React Native's OWN `Modal` — deliberately NOT `@redshank/native`'s
 * `Modal`, which every older sheet in this app used: THAT one's default
 * close button renders an Ionicons glyph, and this app's `Info.plist`
 * only registers `FontAwesome.ttf` under `UIAppFonts` (Android bundles
 * every vector-icons font automatically via `fonts.gradle`, iOS does
 * not) — it draws a missing-glyph box on iOS (first diagnosed in
 * `AccountPickerModal`'s doc comment). RN's `Modal` also wires
 * `onRequestClose` to Android's hardware back button natively, so no
 * manual `BackHandler` listener is needed here, unlike those older
 * sheets.
 *
 * `animationType="slide"` animates the WHOLE modal (backdrop + panel)
 * up from the bottom edge together — simpler and more robust than
 * hand-rolling a separate backdrop-fade/panel-translate animation with
 * its own exit-timing state machine, and it still reads as a bottom
 * sheet sliding in on both platforms.
 */
export const BottomSheet: FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  maxHeight,
  contentStyle,
  testID,
}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.panel,
            maxHeight !== undefined && {maxHeight},
            {paddingBottom: insets.bottom + PANEL_EXTRA_BOTTOM_PADDING},
            contentStyle,
          ]}>
          <View style={styles.handle} />
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors[overlay][0],
  },
  panel: {
    width: '100%',
    backgroundColor: colors[white][0],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  // `flexShrink: 1` (RN's own default is `0`, unlike web/Yoga) is what
  // lets this wrapper — and a `FlatList` child inside it that ALSO
  // carries `flexShrink: 1`, see `BottomSheetProps.children`'s doc
  // comment — actually shrink to fit under `panel`'s `maxHeight`
  // instead of overflowing past it. A no-op when `maxHeight` is unset
  // (nothing to shrink against), so this doesn't change `ActionSheet`.
  body: {
    flexShrink: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors[overlay][2],
    alignSelf: 'center',
    marginBottom: HANDLE_BOTTOM_MARGIN,
  },
});

export default BottomSheet;
