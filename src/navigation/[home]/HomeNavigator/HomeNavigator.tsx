import {HomeBottomTabs} from '@navigation/[home]/HomeBottomTabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export const HomeNavigator = () => {
  console.log('render');
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RootNav"
        component={HomeBottomTabs}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};
