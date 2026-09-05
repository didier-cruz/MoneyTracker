import {Spacer} from '@components/atoms';
import {Headings} from '@components/atoms/text/Headings/Headings';
import {colors, gray} from '@constants/colors/colors';
import {icons} from '@data/icons';
import React, {useState} from 'react';
import {View, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';
import {IconPicker} from '@components/organisms/pickers';
import {Text} from '@components/atoms/text/Text';
import {primary} from '@constants/colors/colors';
import {
  activeItemContainerStyle,
  listStyles,
  listTitle,
  selectedIconColor,
} from './styles';

/**
 * Cuantos iconos de acceso rapido caben ANTES del CTA. La rejilla pone
 * 5 por fila, asi que 14 iconos + el CTA son exactamente 3 filas
 * llenas. `@data/icons` trae 16, que dejaban una cuarta fila con un
 * solo icono suelto y el CTA colgando.
 */
const QUICK_PICK_COUNT = 14;

type SymbolListProps = {
  selectedIcon: any;
  onPressItem: any;
};

/**
 * Solo el titulo. Aqui hubo un boton "..." que abria el catalogo
 * completo, retirado porque el CTA "Mas iconos" de la propia rejilla
 * hace exactamente lo mismo y queda donde el usuario ya esta mirando.
 */
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
    </View>
  );
};

const SymbolList = ({selectedIcon, onPressItem}: SymbolListProps) => {
  const {t} = useTranslation();
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const onPressMore = () => setIsPickerVisible(true);

  const base = icons.slice(0, QUICK_PICK_COUNT);

  // Un icono elegido en el catalogo completo tiene que verse marcado en
  // ESTA rejilla; si no, parecia que la eleccion no se habia guardado.
  // Antes se ANADIA al final, pero ahora eso romperia las 3 filas —
  // 14 iconos + el elegido + el CTA son 16 celdas y vuelve a aparecer
  // una cuarta fila. Asi que ocupa la ultima casilla en vez de sumar
  // una: los 13 primeros no se mueven nunca y el conteo es fijo.
  const quickPicks: IIcon[] =
    selectedIcon && !base.some(({icon}) => icon === selectedIcon.icon)
      ? [...base.slice(0, QUICK_PICK_COUNT - 1), selectedIcon]
      : base;

  return (
    <>
      <SymbolListHeader />
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

        {/* Misma pieza que el "Mas categorias" de `CategoryGrid`: recuadro
            punteado, mas, etiqueta. Vive DENTRO de la rejilla y no solo
            como el boton "..." de la cabecera, porque ahi arriba no se
            lee como "hay mas iconos" — se lee como un menu. */}
        <TouchableOpacity
          activeOpacity={0.5}
          accessibilityRole="button"
          accessibilityLabel={t('icons.seeAllIcons')}
          style={listStyles.listItemContainer}
          onPress={onPressMore}>
          <View style={listStyles.moreItemContainer}>
            <Icon name="plus" size={20} color={colors[primary][0]} />
            <Text
              size={9}
              align="center"
              fontWeight="600"
              color={colors[primary][0]}
              lines={1}
              style={listStyles.moreLabel}>
              {t('icons.moreIcons')}
            </Text>
          </View>
        </TouchableOpacity>
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
