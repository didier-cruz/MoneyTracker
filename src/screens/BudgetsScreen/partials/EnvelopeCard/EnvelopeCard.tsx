import {FC} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Card, Text, Title} from '@redshank/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faPiggyBank} from '@fortawesome/free-solid-svg-icons/faPiggyBank';
import {faFileInvoiceDollar} from '@fortawesome/free-solid-svg-icons/faFileInvoiceDollar';
import {IEnvelopeWithBalance} from '@db/queries';
import {ProgressBar} from '@components/atoms';
import {accent, colors, gray, primary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {getEnvelopeProgress} from '../../mappers';
import {getKindLabel} from '../../CreateEnvelope/partials/KindField/KindField';
import {useTranslation} from 'react-i18next';

interface EnvelopeCardProps {
  envelope: IEnvelopeWithBalance;
  /**
   * The ONLY gesture this card exposes — see this slice's HANDOFF:
   * there is no per-envelope "detail"/"selected" view to switch into
   * (unlike `CatalogCard`'s accounts, which drive a movements list
   * below), so the whole card is one button straight into the
   * assign/withdraw/edit/archive action sheet, rather than reserving a
   * separate small "manage" button for it.
   */
  onPress: () => void;
}

const KIND_ICONS = {
  fund: faPiggyBank,
  debt: faFileInvoiceDollar,
};

// Fixed per kind, not per envelope — the approved prototype shows a
// uniform "chip" treatment, distinguishing fund vs debt only by its
// icon/label, not a whole per-envelope color scheme.
const KIND_CHIP_BACKGROUND = {
  fund: colors[accent][1],
  debt: colors[primary][0],
};

/**
 * One "Sobre" card — see `BudgetsScreen`'s doc comment for the approved
 * layout this implements (radius 20, elevation, type chip, name,
 * balance as `Title level={2}`, 6px progress bar, context line).
 * Progress math/wording is entirely `getEnvelopeProgress`'s
 * responsibility (see `mappers.ts`) — this component only renders
 * whatever it returns, including hiding the bar for a goal-less fund.
 */
export const EnvelopeCard: FC<EnvelopeCardProps> = ({envelope, onPress}) => {
  const {t} = useTranslation();
  const {hasProgress, ratio, contextLine} = getEnvelopeProgress(envelope);
  const kindLabel = getKindLabel(envelope.kind);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('budgets.envelopeCardAccessibilityLabel', {
        name: envelope.name,
        kind: kindLabel,
        balance: formatCentsToCurrency(envelope.balance),
        context: contextLine,
      })}
      accessibilityHint={t('budgets.envelopeCardAccessibilityHint')}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.touchable}>
      <Card style={styles.card}>
        <Card.Body style={styles.body}>
          <View style={styles.chipRow}>
            <View
              style={[
                styles.chipIcon,
                {backgroundColor: KIND_CHIP_BACKGROUND[envelope.kind]},
              ]}>
              <FontAwesomeIcon
                icon={KIND_ICONS[envelope.kind]}
                color={colors[white][0]}
                size={16}
              />
            </View>
            <Text color={colors[gray][0]} size={11} style={styles.chipLabel}>
              {kindLabel}
            </Text>
          </View>

          <Text lines={1} style={styles.name}>
            {envelope.name}
          </Text>
          <Title level={2}>{formatCentsToCurrency(envelope.balance)}</Title>

          {hasProgress && (
            <ProgressBar
              progress={ratio}
              height={6}
              color={colors.success[0]}
              style={styles.progress}
              accessibilityLabel={contextLine}
            />
          )}
          <Text color={colors[gray][0]} size={11} lines={1}>
            {contextLine}
          </Text>
        </Card.Body>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    marginLeft: 20,
  },
  card: {
    width: 170,
    borderRadius: 20,
    elevation: 10,
  },
  body: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chipIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chipLabel: {
    flexShrink: 1,
  },
  name: {
    marginBottom: 2,
  },
  progress: {
    marginTop: 8,
    marginBottom: 6,
  },
});

export default EnvelopeCard;
