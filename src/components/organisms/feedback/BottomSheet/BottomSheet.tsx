import {FC, ReactNode} from 'react';
import {Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors, overlay, white} from '@constants/colors/colors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const HANDLE_BOTTOM_MARGIN = 12;
const PANEL_EXTRA_BOTTOM_PADDING = 8;

/**
 * Shared bottom-sheet chrome for `ActionSheet`, and available to any
 * future sheet — see this folder's README-equivalent (this slice's
 * HANDOFF) for why `AssignWithdrawModal`/`CategoryLimitModal` were left
 * on their own hand-built shape instead of migrated onto this one.
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
            {paddingBottom: insets.bottom + PANEL_EXTRA_BOTTOM_PADDING},
            contentStyle,
          ]}>
          <View style={styles.handle} />
          {children}
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
