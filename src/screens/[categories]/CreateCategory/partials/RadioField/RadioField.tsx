import {SegmentedControl, SegmentedControlOption} from '@components/atoms/SegmentedControl';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';

const styles = StyleSheet.create({
  container: {width: '100%'},
});

type Props = {
  value: ICategory['type'];
  onChange: (type: ICategory['type']) => void;
};

/**
 * Expense/income picker — was `@redshank/native`'s `Radio.Group`, now
 * the shared `SegmentedControl` atom (see that component's doc comment
 * for why: this app already has this exact "pick one of two" pattern
 * solved visually in `TypeSegment`/`LanguageSwitch`, no need for a
 * third style). The old `isCategoryType` runtime guard against
 * `Radio.Group`'s untyped `onChange(key: string | number)` is gone too
 * — `SegmentedControl`'s `onChange` is typed straight from `options`
 * (`ICategory['type']`), no cast/guard needed.
 */
const RadioField = ({value, onChange}: Props) => {
  const {t} = useTranslation();
  const options: SegmentedControlOption<ICategory['type']>[] = [
    {value: 'expense', label: t('categories.expenses')},
    {value: 'income', label: t('categories.incomes')},
  ];

  return (
    <View style={styles.container}>
      <SegmentedControl value={value} onChange={onChange} options={options} />
    </View>
  );
};

export default RadioField;
