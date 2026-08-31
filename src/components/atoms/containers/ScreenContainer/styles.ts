import {StyleSheet} from 'react-native';

export default StyleSheet.create({
  screenContainer: {
    width: '100%',
    paddingHorizontal: 15,
    // El FAB sobresale por encima de la barra de tabs (ver FAB_OVERHANG en
    // navOptions). Este margen evita que el ultimo elemento de una pantalla
    // con scroll quede debajo de el.
    paddingBottom: 32,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
});
