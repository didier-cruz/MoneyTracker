import 'react-native-gesture-handler';
import {useEffect} from 'react';
import {initDatabase} from '@db/db';
import {DrawerNav} from '@navigation/DrawerNav';
import {ThemeProvider} from '@redshank/native';
import {NavigationContainer} from '@react-navigation/native';
import {themeLight} from '@constants/theme/theme';
import icons from './src/icons';
import {hydrateStoredLanguage} from '@i18n';

function App(): JSX.Element {
  useEffect(() => {
    const init = async () => {
      // registrando iconos
      icons();
      // aplicando el idioma guardado (i18n ya arrancó con el del dispositivo)
      await hydrateStoredLanguage();
      // iniciando base de datos
      try {
        await initDatabase();
      } catch (error) {
        // initDatabase ahora propaga: sin esto el fallo saldria como
        // unhandled promise rejection en vez de quedar registrado.
        console.error('[App] database initialization failed:', error);
      }
    };
    init();
  }, []);

  return (
    <AppState>
      <DrawerNav />
    </AppState>
  );
}

const AppState = ({children}: any) => {
  return (
    <NavigationContainer>
      <ThemeProvider
        theme={{
          theme: 'light',
          colors: themeLight.colors,
        }}
        disableDarkMode>
        {children}
      </ThemeProvider>
    </NavigationContainer>
  );
};

export default App;
