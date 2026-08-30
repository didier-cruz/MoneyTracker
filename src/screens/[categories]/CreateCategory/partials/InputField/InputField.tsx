import {Headings} from '@components/atoms/text/Headings/Headings';
import {
  accent,
  black,
  colors,
  gray,
  secondary,
  white,
} from '@constants/colors/colors';
import React from 'react';
import {KeyboardTypeOptions, StyleSheet, TextInput} from 'react-native';
import {useTranslation} from 'react-i18next';

type Props = {
  inputText: string;
  onChangeInputText: (text: string) => void;
  error: string;
  /** Defaults to the category-name copy this field originally shipped
   * with — pass an explicit value for any other reuse (e.g. account
   * name/initial balance in `CreateAccount`). */
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  accessibilityLabel?: string;
};

const InputField = ({
  inputText,
  onChangeInputText,
  error,
  placeholder,
  keyboardType = 'default',
  accessibilityLabel,
}: Props) => {
  const {t} = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('categories.addCategoryNamePlaceholder');
  return (
    <>
      <TextInput
        value={inputText}
        style={inputStyles.textInput}
        onChangeText={onChangeInputText}
        placeholder={resolvedPlaceholder}
        placeholderTextColor={colors[gray][0]}
        keyboardType={keyboardType}
        accessibilityLabel={accessibilityLabel ?? resolvedPlaceholder}
      />
      <Headings
        containerStyle={inputStyles.errorMessage}
        headingSize="H6"
        color={colors[secondary][0]}>
        {error}
      </Headings>
    </>
  );
};

const inputStyles = StyleSheet.create({
  textInput: {
    height: 50,
    width: '100%',
    paddingHorizontal: 20,
    // paddingLeft: 15,
    textAlign: 'left',
    color: colors[accent][2],
    backgroundColor: colors[white][0],
    borderColor: colors[black][0],
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  errorMessage: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
});

export default InputField;
