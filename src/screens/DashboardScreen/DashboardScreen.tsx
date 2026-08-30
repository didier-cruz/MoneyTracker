import {NavigationControl} from '@components/atoms/NavigationControl';
import {ScreenContainer} from '@components/atoms/containers/ScreenContainer';
import {StackNavParams} from '@navigation/StackNav/types';
import {StackScreenProps} from '@react-navigation/stack';
import React from 'react';
import {Text} from 'react-native';
import {useTranslation} from 'react-i18next';

interface DashboardScreenProps
  extends StackScreenProps<StackNavParams, 'Dashboard'> {}

export const DashboardScreen = ({navigation}: DashboardScreenProps) => {
  const {t} = useTranslation();

  return (
    <ScreenContainer>
      <NavigationControl
        firstActionPress={() => navigation.navigate('Dashboard')}
        secondActionPress={() => navigation.navigate('Form')}
        firstActive
      />
      <Text>{t('common.dashboardScreenPlaceholder')}</Text>
    </ScreenContainer>
  );
};
