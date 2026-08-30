import {Spacer} from '@components/atoms';
import {Headings} from '@components/atoms/text/Headings/Headings';
import {accent, colors, gray} from '@constants/colors/colors';
import {icons} from '@data/icons';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';
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

const SymbolListHeader = () => {
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
      <TouchableOpacity style={listTitle.action}>
        <FontAwesomeIcon icon="ellipsis" size={25} color={colors[accent][0]} />
      </TouchableOpacity>
    </View>
  );
};

const SymbolList = ({selectedIcon, onPressItem}: SymbolListProps) => {
  return (
    <>
      <SymbolListHeader />
      <Spacer space={15} />
      <View style={listStyles.listContainer}>
        {icons.map(({id, icon}: IIcon) => {
          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.5}
              style={listStyles.listItemContainer}
              onPress={() => onPressItem(id, icon)}>
              <View style={activeItemContainerStyle(id, selectedIcon?.id)}>
                <Icon
                  name={icon}
                  size={30}
                  color={selectedIconColor(id, selectedIcon?.id)}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};

export default SymbolList;
