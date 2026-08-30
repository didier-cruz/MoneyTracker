import {accent, colors} from '@constants/colors/colors';
import {Radio} from '@redshank/native';
import {CATEGORY_TYPES} from '@db/queries';
import React from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';

type Props = {
  value: ICategory['type'];
  onChange: (type: ICategory['type']) => void;
};

// Guards the library's untyped `onChange(key: string | number)` callback
// against the one source of truth for valid values (`@db/queries`'
// `CATEGORY_TYPES`) instead of a bare `as` cast to `ICategory['type']`.
const isCategoryType = (value: string | number): value is ICategory['type'] =>
  typeof value === 'string' &&
  (CATEGORY_TYPES as readonly string[]).includes(value);

const RadioField = ({value, onChange}: Props) => {
  const {t} = useTranslation();
  return (
    <View
      style={{
        width: '100%',
      }}>
      <Radio.Group
        value={value}
        onChange={key => {
          if (isCategoryType(key)) {
            onChange(key);
          }
        }}
        size="middle"
        activeColor={colors[accent][1]}>
        <Radio label={t('categories.expenses')} value="expense" />
        <Radio label={t('categories.incomes')} value="income" />
      </Radio.Group>
    </View>
  );
};

export default RadioField;
