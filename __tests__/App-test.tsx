/**
 * @format
 */

import 'react-native';
import React from 'react';
import App from '../App';

// Note: test renderer must be required after react-native.
import renderer, {act} from 'react-test-renderer';

it('renders correctly', async () => {
  // App arranca la base de datos en un useEffect async. Sin envolver el render
  // en `act` asincrono, el test termina antes de que ese efecto resuelva y Jest
  // desmonta el entorno con trabajo en vuelo.
  await act(async () => {
    renderer.create(<App />);
  });
});
