import {
  Select,
  SelectProps,
  SelectProvider,
} from '@mobile-reality/react-native-select-pro';
import {FC} from 'react';
import {View} from 'react-native';
import {selectStyles} from './styles';
import {colors} from '@constants/colors/colors';

/**
 * Envoltorio del selector. Antes leia la paleta del `ThemeProvider` de
 * @redshank/native; ahora usa los tokens del proyecto, que son la fuente
 * de verdad desde que esa dependencia se retiro.
 */
const SelectPro: FC<SelectProps> = props => {
  const theme = {
    primary: colors.primary[0],
    secondary: colors.accent[1],
    accent: colors.accent[0],
    inactive: colors.accent[2],
    text: colors.text[0],
  };

  return (
    <SelectProvider>
      <View style={{marginBottom: 30, width: 200}}>
        <Select {...props} styles={{...selectStyles(theme)}} />
      </View>
    </SelectProvider>
  );
};

export default SelectPro;
