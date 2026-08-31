import {colors, gray} from '@constants/colors/colors';
import {SegmentedControl, SegmentedControlOption} from '@components/atoms/SegmentedControl';
import {Text} from '@components/atoms/text/Text';
import {ENVELOPE_KINDS, EnvelopeKind} from '@db/queries';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import i18n from '@i18n';

type Props = {
  value: EnvelopeKind;
  /** Omitted (not just disabled) in edit mode — see below. */
  onChange?: (kind: EnvelopeKind) => void;
};

/** Translated label for an envelope `kind` — same pattern as accounts'
 * `getKindLabel` (`KindField.tsx` under `AccountsScreen/CreateAccount`):
 * plain `i18n.t`, callers render it and should call `useTranslation()`
 * themselves so they re-render when the language changes. */
export const getKindLabel = (kind: EnvelopeKind): string => i18n.t(`budgets.envelopeKindLabels.${kind}`);

const styles = StyleSheet.create({
  container: {width: '100%'},
  lockedRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedHint: {
    marginLeft: 8,
  },
});

/**
 * `onChange` omitted entirely (not merely a disabled control) switches
 * this into a plain, read-only label — `updateEnvelope` has no `kind`
 * field at all (see its doc comment: flipping a `fund` into a `debt`
 * mid-life would silently change what every past movement already
 * recorded against it means), so `CreateEnvelope` never renders an
 * editable kind control once it's in edit mode; there is nothing to
 * disable-but-show, the choice genuinely no longer exists for this
 * envelope.
 *
 * Was `@redshank/native`'s `Radio.Group` — now the shared
 * `SegmentedControl` atom, see that component's doc comment. The old
 * `isEnvelopeKind` runtime guard against `Radio.Group`'s untyped
 * `onChange(key: string | number)` is gone too — `SegmentedControl`'s
 * `onChange` is typed straight from `options` (`EnvelopeKind`), no
 * cast/guard needed.
 */
const KindField = ({value, onChange}: Props) => {
  const {t} = useTranslation();

  if (!onChange) {
    return (
      <View style={styles.lockedRow}>
        <Text>{getKindLabel(value)}</Text>
        <Text color={colors[gray][0]} size={12} style={styles.lockedHint}>
          {t('budgets.kindCannotBeChanged')}
        </Text>
      </View>
    );
  }

  const options: SegmentedControlOption<EnvelopeKind>[] = ENVELOPE_KINDS.map(kind => ({
    value: kind,
    label: getKindLabel(kind),
  }));

  return (
    <View style={styles.container}>
      <SegmentedControl value={value} onChange={onChange} options={options} />
    </View>
  );
};

export default KindField;
