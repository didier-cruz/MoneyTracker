import {Spacer} from '@components/atoms';
import {colors, gray} from '@constants/colors/colors';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {useNavigation} from '@react-navigation/native';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';

type HeaderProps = {
  title: string;
  message?: string;
};

const Header = ({title, message}: HeaderProps) => {
  const navigation = useNavigation();

  return (
    <View style={headerStyles.container}>
      <View style={{flexDirection: 'row'}}>
        <TouchableOpacity onPress={navigation.goBack}>
          <FontAwesomeIcon
            icon="chevron-left"
            color={colors[gray][1]}
            size={30}
            style={{marginRight: 10, marginTop: 5}}
          />
        </TouchableOpacity>
        <Title level={1}>{title}</Title>
      </View>
      {message && (
        <>
          <Text>{message}</Text>
          <Spacer space={20} />
        </>
      )}
    </View>
  );
};

export default Header;

const headerStyles = StyleSheet.create({
  container: {
    // flexDirection: 'row',
    padding: 25,
    paddingLeft: 0,
    paddingBottom: 0,
    width: '100%',
  },
});
