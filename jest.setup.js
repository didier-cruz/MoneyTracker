/**
 * Setup compartido de Jest.
 *
 * Las librerias nativas de la app registran TurboModules al importarse, que no
 * existen en el entorno de Node donde corre Jest. Aqui se cargan sus mocks
 * oficiales antes de que cualquier test importe App.tsx.
 */

// Registra los mocks de los TurboModules de gesture-handler.
require('react-native-gesture-handler/jestSetup');

// Reanimated expone su propio helper de tests, que instala los mocks de
// worklets, animaciones y del modulo nativo.
require('react-native-reanimated').setUpTests();
