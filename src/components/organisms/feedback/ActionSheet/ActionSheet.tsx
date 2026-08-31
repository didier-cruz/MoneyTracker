import {FC, Fragment} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {useTranslation} from 'react-i18next';
import {colors, overlay, primary, text as textColorKey} from '@constants/colors/colors';
import {BottomSheet} from '../BottomSheet/BottomSheet';
import {MODAL_CHAIN_DELAY_MS} from '../constants';

export type ActionSheetTone = 'default' | 'destructive';

export interface ActionSheetAction {
  /** Stable key for the row, also used as the default a11y label
   * fallback's `key` prop — NOT shown, just React's list key. */
  key: string;
  label: string;
  icon: IconDefinition;
  /** @default 'default' */
  tone?: ActionSheetTone;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
}

// 20 (sheet's own paddingHorizontal) + 36 (icon box) + 14 (row gap) —
// the divider is inset to align with the LABEL, not full bleed, per
// the approved spec.
const DIVIDER_INSET = 20 + 36 + 14;

const TONE_TINT = {
  // 12% alpha — `${hex}1F` is the same "append an alpha hex byte"
  // idiom `EnvelopeCard` already uses for its own tinted icon chip
  // (`${colors.error[0]}2E`, ~18%); 0.12 * 255 ≈ 31 → `1F`.
  default: `${colors[primary][0]}1F`,
  // 14% alpha, same idiom: 0.14 * 255 ≈ 36 → `24`.
  destructive: `${colors.error[0]}24`,
};

const TONE_COLOR = {
  default: colors[primary][0],
  destructive: colors.error[0],
};

/**
 * Bottom-sheet action menu — replaces every `Alert.alert(title,
 * undefined, [...])` menu in this app (see this slice's HANDOFF for the
 * full inventory: `BudgetsScreen`'s envelope manage menu,
 * `AccountsScreen`'s account manage menu).
 *
 * Each row's `onPress` is NOT called directly on tap — it's deferred
 * behind `onClose` (see `MODAL_CHAIN_DELAY_MS`'s doc comment): several
 * of these actions open a SECOND modal (a `ConfirmDialog` for
 * "Archive") or navigate to a screen that itself renders one
 * (`EditAccount`/`EditEnvelope`'s own form). Firing that second modal
 * before this sheet has finished closing stacks two RN `Modal`s at
 * once, which wedges Android's hardware back button — reproduced in
 * the emulator while building this feature.
 */
export const ActionSheet: FC<ActionSheetProps> = ({visible, title, subtitle, actions, onClose}) => {
  const {t} = useTranslation();

  const handlePressAction = (action: ActionSheetAction) => {
    onClose();
    setTimeout(action.onPress, MODAL_CHAIN_DELAY_MS);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {actions.map((action, index) => {
        const tone = action.tone ?? 'default';
        return (
          <Fragment key={action.key}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              onPress={() => handlePressAction(action)}
              style={styles.row}>
              <View style={[styles.iconBox, {backgroundColor: TONE_TINT[tone]}]}>
                <FontAwesomeIcon icon={action.icon} size={20} color={TONE_COLOR[tone]} />
              </View>
              <Text style={[styles.label, {color: TONE_COLOR[tone]}]}>{action.label}</Text>
            </TouchableOpacity>
            {index < actions.length - 1 ? <View style={styles.divider} /> : null}
          </Fragment>
        );
      })}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        onPress={onClose}
        style={styles.cancelRow}>
        <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors[textColorKey][0],
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray[0],
    marginTop: 2,
  },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: DIVIDER_INSET,
    backgroundColor: colors[overlay][1],
  },
  cancelRow: {
    height: 48,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 16,
    color: colors.gray[0],
  },
});

export default ActionSheet;
