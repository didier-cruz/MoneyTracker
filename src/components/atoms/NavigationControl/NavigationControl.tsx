import { black, colors, white } from '@constants/colors/colors';
import { windowHeight } from '@constants/dimensions/Dimensions';
import { GlobalStyles } from '@constants/styles/global.styles';
import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {NavigationControlProps} from './types';

export const NavigationControl = ({
  firstActionPress,
  secondActionPress,
  firstActive
}: NavigationControlProps) => {
  const {t} = useTranslation();

  return (
    <View
      style={[
        GlobalStyles.alignItemsCenter,
        {
          marginTop: 20,
          flexDirection: 'row',
          height: windowHeight * 0.07,
          // backgroundColor: 'black',
        },
      ]}>
      <Pressable
        //   onPress={() => navigation.navigate('Dashboard')}
        onPress={firstActionPress}
        style={[
          GlobalStyles.justifyContentCenter,
          GlobalStyles.alignItemsCenter,
          {
            backgroundColor: firstActive ? colors[black][0] : colors[white][0],
            width: '30%',
            height: '70%',
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
            borderWidth: firstActive ? 0 : 3,
          },
        ]}>
        <Text
          style={{
            // backgroundColor: 'green',
            color: firstActive ? colors[white][0] : colors[black][0],
            fontWeight: 'bold'
          }}>
          {t('common.dashboard')}
        </Text>
      </Pressable>
      <Pressable
        //   onPress={() => navigation.navigate('Form')}
        onPress={secondActionPress}
        style={[
          GlobalStyles.justifyContentCenter,
          GlobalStyles.alignItemsCenter,
          {
            width: '30%',
            height: '70%',
            backgroundColor: !firstActive ? colors[black][0] : colors[white][0],
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
            borderWidth: !firstActive ? 0 : 3,

          },
        ]}>
        <Text
          style={{
            // backgroundColor: 'blue',
            color: !firstActive ? colors[white][0] : colors[black][0],
            fontWeight: 'bold'
          }}>
          {t('common.records')}
        </Text>
      </Pressable>
    </View>
  );
};
