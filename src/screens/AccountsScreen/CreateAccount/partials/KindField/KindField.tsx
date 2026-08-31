import {SegmentedControl, SegmentedControlOption} from '@components/atoms/SegmentedControl';
import {ACCOUNT_KINDS, AccountKind} from '@db/queries';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import i18n from '@i18n';

type Props = {
  value: AccountKind;
  onChange: (kind: AccountKind) => void;
};

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

/**
 * Was `@redshank/native`'s `Radio.Group`, now the shared
 * `SegmentedControl` atom — see that component's doc comment for why:
 * this app already has this exact "pick one of two" pattern solved
 * visually in `TypeSegment`/`LanguageSwitch`, no need for a third
 * style. The old `isAccountKind` runtime guard against `Radio.Group`'s
 * untyped `onChange(key: string | number)` is gone too —
 * `SegmentedControl`'s `onChange` is typed straight from `options`
 * (`AccountKind`), no cast/guard needed.
 */
const KindField = ({value, onChange}: Props) => {
  useTranslation();
  const options: SegmentedControlOption<AccountKind>[] = ACCOUNT_KINDS.map(kind => ({
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
