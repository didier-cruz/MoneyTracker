import React from 'react';
import {View, Image} from 'react-native';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import {accent, colors} from '@constants/colors/colors';
import {StyleSheet} from 'react-native';
import {heightDP} from '@utils/responsive';
import {useTranslation} from 'react-i18next';
import {Text as RSText} from '@components/atoms/text/Text';
import {LanguageSwitch} from '@components/atoms/LanguageSwitch';

const CustomDrawer = (props: DrawerContentComponentProps) => {
  const {t} = useTranslation();
  return (
    <View style={{flex: 1}}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{backgroundColor: 'transparent'}}>
        <Image
          source={{
            uri: 'https://firebasestorage.googleapis.com/v0/b/apphive-inc.appspot.com/o/usersmedia%2Fv3cF2tYZaJtYVXGZfJAjTp?alt=media&token=5b4ce29c-e5f8-4444-b07b-3866cfe2a96a',
          }}
          style={{
            height: heightDP(20),
            width: heightDP(25),
            // borderRadius: 40,
            // marginBottom: 10,
          }}
        />
        <View style={{flex: 1, backgroundColor: 'transparent', paddingTop: 10}}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>
      <View style={{padding: 20, borderTopWidth: 1, borderTopColor: '#ccc'}}>
        <View style={drawerStyles.languageBlock}>
          <RSText size={12} color={colors[accent][0]} style={drawerStyles.languageLabel}>
            {t('drawer.language')}
          </RSText>
          <LanguageSwitch onDark />
        </View>
        {/* Aqui vivia un "Cerrar sesion" con `onPress={() => {}}`: se
            veia, se podia pulsar y no hacia absolutamente nada desde que
            se escribio. Se retira entero en vez de darle una accion,
            porque la accion no existe — esta app no tiene backend, ni
            autenticacion, ni sesion que cerrar (ver la primera seccion
            del CLAUDE.md). Un control que promete algo inexistente es
            peor que su ausencia. */}
      </View>
    </View>
  );
};

const drawerStyles = StyleSheet.create({
  languageBlock: {
    paddingBottom: 14,
  },
  languageLabel: {
    marginBottom: 7,
  },
});

export default CustomDrawer;
