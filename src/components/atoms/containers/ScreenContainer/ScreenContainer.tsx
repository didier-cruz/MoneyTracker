import React, {FC} from 'react';
import {SafeAreaView} from 'react-native';
import styles from './styles';
import {ScreenContainerTypes} from './types';

export const ScreenContainer: FC<ScreenContainerTypes> = ({
  children,
  containerStyle,
}) => {
  return (
    <SafeAreaView style={[styles.screenContainer, containerStyle]}>
      {children}
    </SafeAreaView>
  );
};
