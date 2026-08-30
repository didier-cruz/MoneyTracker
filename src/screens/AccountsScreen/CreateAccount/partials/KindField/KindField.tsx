import {accent, colors} from '@constants/colors/colors';
import {Radio} from '@redshank/native';
import {ACCOUNT_KINDS, AccountKind} from '@db/queries';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import i18n from '@i18n';

type Props = {
  value: AccountKind;
  onChange: (kind: AccountKind) => void;
};

// Guards the library's untyped `onChange(key: string | number)` callback
// against the one source of truth for valid values (`@db/queries`'
// `ACCOUNT_KINDS`) instead of a bare `as` cast to `AccountKind` — same
// pattern as `RadioField` (categories' type selector).
const isAccountKind = (value: string | number): value is AccountKind =>
  typeof value === 'string' && (ACCOUNT_KINDS as readonly string[]).includes(value);

/**
 * Translated label for an account `kind` — used both here (radio
 * options) and by `ArchivedAccounts` (row subtitle/accessibility
 * label). Plain `i18n.t` (not `useTranslation`) so it also works
 * outside a component's render; callers that render its result should
 * still call `useTranslation()` themselves so they re-render (and
 * re-read this) when the language changes.
 */
export const getKindLabel = (kind: AccountKind): string => i18n.t(`accounts.kindLabels.${kind}`);

const styles = StyleSheet.create({
  container: {width: '100%'},
});

const KindField = ({value, onChange}: Props) => {
  useTranslation();

  return (
    <View style={styles.container}>
      <Radio.Group
        value={value}
        onChange={key => {
          if (isAccountKind(key)) {
            onChange(key);
          }
        }}
        size="middle"
        activeColor={colors[accent][1]}>
        {ACCOUNT_KINDS.map(kind => (
          <Radio key={kind} label={getKindLabel(kind)} value={kind} />
        ))}
      </Radio.Group>
    </View>
  );
};

export default KindField;
