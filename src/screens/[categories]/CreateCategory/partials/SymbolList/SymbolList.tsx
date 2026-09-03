import {Spacer} from '@components/atoms';
import {Headings} from '@components/atoms/text/Headings/Headings';
import {accent, colors, gray} from '@constants/colors/colors';
import {icons} from '@data/icons';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import React, {useState} from 'react';
import {View, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';
import {IconPicker} from '@components/organisms/pickers';
import {
  activeItemContainerStyle,
  listStyles,
  listTitle,
  selectedIconColor,
} from './styles';

type SymbolListProps = {
  selectedIcon: any;
  onPressItem: any;
};

type SymbolListHeaderProps = {onPressMore: () => void};

const SymbolListHeader = ({onPressMore}: SymbolListHeaderProps) => {
  const {t} = useTranslation();
  return (
    <View style={listTitle.container}>
      <Headings
        headingSize={'H3'}
        color={colors[gray][1]}
        fontWeight="600"
        containerStyle={listTitle.heading}>
        {t('categories.chooseAnIcon')}
      </Headings>
      {/* Este boton existia desde el principio pero no tenia `onPress`:
          se veia y no hacia nada. Ahora abre el catalogo completo. */}
      <TouchableOpacity
        style={listTitle.action}
        accessibilityRole="button"
        accessibilityLabel={t('icons.seeAllIcons')}
        onPress={onPressMore}>
        <FontAwesomeIcon icon="ellipsis" size={25} color={colors[accent][0]} />
      </TouchableOpacity>
    </View>
  );
};

const SymbolList = ({selectedIcon, onPressItem}: SymbolListProps) => {
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  // Los 16 de siempre como acceso rapido, mas el elegido cuando viene del
  // catalogo completo: sin esto, elegir un icono en el selector lo dejaba
  // marcado en ningun sitio de esta rejilla y parecia que no se habia
  // guardado nada.
  const quickPicks: IIcon[] =
    selectedIcon && !icons.some(({icon}) => icon === selectedIcon.icon)
      ? [...icons, selectedIcon]
      : icons;

  return (
    <>
      <SymbolListHeader onPressMore={() => setIsPickerVisible(true)} />
      <Spacer space={15} />
      <View style={listStyles.listContainer}>
        {quickPicks.map(({id, icon}: IIcon) => {
          return (
            <TouchableOpacity
              key={icon}
              activeOpacity={0.5}
              style={listStyles.listItemContainer}
              onPress={() => onPressItem(id, icon)}>
              <View style={activeItemContainerStyle(icon, selectedIcon?.icon)}>
                <Icon
                  name={icon}
                  size={30}
                  color={selectedIconColor(icon, selectedIcon?.icon)}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <IconPicker
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        selectedName={selectedIcon?.icon}
        onSelect={icon => onPressItem(icon.id, icon.icon)}
      />
    </>
  );
};

export default SymbolList;
