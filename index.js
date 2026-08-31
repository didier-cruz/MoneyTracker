/**
 * @format
 */

// i18n PRIMERO, antes que cualquier modulo que renderice texto
// traducido. `App.tsx` lo importaba despues del arbol de navegacion, asi
// que las etiquetas de las pestanas se evaluaban con i18n aun sin
// inicializar y salian como claves crudas (`resumen.title`) en el
// arranque en frio, corrigiendose al navegar.
import '@i18n';

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
