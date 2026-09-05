import 'react-native-gesture-handler';
import {useEffect} from 'react';
import {initDatabase, getDbConnection} from '@db/db';
import {seedDefaultCategoriesOnce} from '@db/queries';
import {DrawerNav} from '@navigation/DrawerNav';
import {NavigationContainer} from '@react-navigation/native';
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
        // Categorias por defecto, una sola vez por instalacion. Va
        // DESPUES de `hydrateStoredLanguage()` a proposito: los nombres
        // se guardan como dato en el idioma activo, y antes de hidratar
        // el idioma activo todavia es el del dispositivo, que puede no
        // ser el que el usuario eligio.
        const db = await getDbConnection();
        const seed = await seedDefaultCategoriesOnce(db);
        if (seed.ran) {
          console.log(
            `[App] categorias por defecto: ${seed.inserted} insertadas` +
              (seed.renamedLegacyInterests ? ', "Interests" renombrado' : ''),
          );
        }
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
<NavigationContainer>{children}</NavigationContainer>
  );
};

export default App;
