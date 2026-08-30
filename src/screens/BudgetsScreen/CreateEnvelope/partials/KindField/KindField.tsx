import {accent, colors, gray} from '@constants/colors/colors';
import {Radio, Text} from '@redshank/native';
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

// Same guard pattern as accounts' `KindField` — the library's untyped
// `onChange(key: string | number)` callback checked against the one
// source of truth for valid values (`@db/queries`' `ENVELOPE_KINDS`)
// instead of a bare `as` cast.
const isEnvelopeKind = (value: string | number): value is EnvelopeKind =>
  typeof value === 'string' && (ENVELOPE_KINDS as readonly string[]).includes(value);

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
 * `onChange` omitted entirely (not merely a disabled `Radio.Group`)
 * switches this into a plain, read-only label — `updateEnvelope` has no
 * `kind` field at all (see its doc comment: flipping a `fund` into a
 * `debt` mid-life would silently change what every past movement
 * already recorded against it means), so `CreateEnvelope` never renders
 * an editable kind control once it's in edit mode; there is nothing to
 * disable-but-show, the choice genuinely no longer exists for this
 * envelope.
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

  return (
    <View style={styles.container}>
      <Radio.Group
        value={value}
        onChange={key => {
          if (isEnvelopeKind(key)) {
            onChange(key);
          }
        }}
        size="middle"
        activeColor={colors[accent][1]}>
        {ENVELOPE_KINDS.map(kind => (
          <Radio key={kind} label={getKindLabel(kind)} value={kind} />
        ))}
      </Radio.Group>
    </View>
  );
};

export default KindField;
