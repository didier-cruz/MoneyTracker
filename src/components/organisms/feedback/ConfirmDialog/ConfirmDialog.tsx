import {FC} from 'react';
import {Modal, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {faCircleExclamation} from '@fortawesome/free-solid-svg-icons/faCircleExclamation';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import {faTriangleExclamation} from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import {colors, accent, overlay, primary, text as textColorKey} from '@constants/colors/colors';

export type ConfirmDialogTone = 'info' | 'warning' | 'danger';

interface ConfirmDialogProps {
  visible: boolean;
  tone: ConfirmDialogTone;
  title: string;
  message: string;
  /** Android hardware back button / backdrop tap. Two-button dialogs
   * should usually pass the same handler as `onSecondaryPress` (back
   * out = cancel); the single-button informational variant should pass
   * the same handler as `onPrimaryPress` (there's nothing to cancel,
   * only to dismiss). */
  onRequestClose: () => void;
  primaryLabel: string;
  onPrimaryPress: () => void;
  /** Omit both `secondaryLabel`/`onSecondaryPress` for the single-button
   * informational variant (heads-up notices, save-error/success
   * dismiss-only alerts). */
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  /** Tints the primary button red-filled/white-text instead of the
   * default lime-filled/dark-green-text. Only meaningful on a
   * two-button dialog — a single-button FYI is never itself "the
   * destructive action", it's just dismissed. */
  destructive?: boolean;
}

const TONE_ICON: Record<ConfirmDialogTone, IconDefinition> = {
  info: faCircleInfo,
  warning: faTriangleExclamation,
  danger: faCircleExclamation,
};

// Same "append an alpha hex byte" idiom as `ActionSheet`'s `TONE_TINT`
// — 12% for info/warning, 14% for danger (matching `ActionSheet`'s own
// destructive-tone alpha, the one hard number this design spelled out).
const TONE_TINT: Record<ConfirmDialogTone, string> = {
  info: `${colors[primary][0]}1F`,
  warning: `${colors.warning[0]}1F`,
  danger: `${colors.error[0]}24`,
};

const TONE_COLOR: Record<ConfirmDialogTone, string> = {
  info: colors[primary][0],
  warning: colors.warning[0],
  danger: colors.error[0],
};

/**
 * Centered confirmation/notice dialog — replaces every
 * `Alert.alert(title, message, [cancel, confirm])` and every
 * dismiss-only `Alert.alert(title, message)` in this app (see this
 * slice's HANDOFF for the full inventory and the tone each call site
 * uses: `danger` for destructive confirmations and every
 * `common.error` notice, `warning` for the non-blocking
 * over-allocated/overdrawn heads-ups, `info` for success confirmations
 * and the non-destructive "restore" confirmation).
 *
 * Renders its own `Modal` rather than reusing `BottomSheet` — this is a
 * CENTERED card, not a sheet anchored to the bottom edge, so the two
 * don't share layout, only the same backdrop treatment/back-button
 * wiring.
 */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  visible,
  tone,
  title,
  message,
  onRequestClose,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  destructive,
}) => {
  const {t} = useTranslation();
  const isSingleButton = secondaryLabel === undefined;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={styles.card} accessible accessibilityRole="alert">
          <View style={[styles.badge, {backgroundColor: TONE_TINT[tone]}]}>
            <FontAwesomeIcon icon={TONE_ICON[tone]} size={22} color={TONE_COLOR[tone]} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonsRow}>
            {!isSingleButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={secondaryLabel}
                onPress={onSecondaryPress ?? onRequestClose}
                style={styles.secondaryButton}>
                <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              onPress={onPrimaryPress}
              style={[styles.primaryButton, destructive && styles.primaryButtonDestructive]}>
              <Text style={[styles.primaryLabel, destructive && styles.primaryLabelDestructive]}>
                {primaryLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const CARD_MAX_WIDTH = 380;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors[overlay][0],
  },
  card: {
    width: '86%',
    maxWidth: CARD_MAX_WIDTH,
    borderRadius: 20,
    padding: 24,
    backgroundColor: colors.white[0],
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors[textColorKey][0],
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors[textColorKey][1],
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray[0],
  },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors[accent][0],
  },
  primaryButtonDestructive: {
    backgroundColor: colors.error[0],
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors[accent][3],
  },
  primaryLabelDestructive: {
    color: colors.white[0],
  },
});

export default ConfirmDialog;
