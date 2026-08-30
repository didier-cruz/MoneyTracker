import {Headings} from '@components/atoms/text/Headings/Headings';
import {accent, colors} from '@constants/colors/colors';
import {GlobalStyles} from '@constants/styles/global.styles';
import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';

type Props = {
  onSave: () => void;
  disabled?: boolean;
};

const SaveAction = ({onSave, disabled = false}: Props) => {
  const {t} = useTranslation();
  return (
    <View style={GlobalStyles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{disabled}}
        disabled={disabled}
        onPress={onSave}
        style={[buttonStyles.save, disabled && buttonStyles.saveDisabled]}>
        <Headings headingSize="H4" color={colors[accent][3]} fontWeight="600">
          {t('common.save')}
        </Headings>
      </TouchableOpacity>
    </View>
  );
};

export default SaveAction;

const buttonStyles = StyleSheet.create({
  save: {
    backgroundColor: colors[accent][0],
    width: '70%',
    height: 50,
    paddingVertical: 10,
    borderRadius: 15,
    marginVertical: 10,
    justifyContent: 'center',
  },
  saveDisabled: {
    opacity: 0.5,
  },
});
