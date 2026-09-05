import {accent, colors, gray, primary, white} from '@constants/colors/colors';
import {StyleSheet} from 'react-native';

export const listTitle = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    // `flex: 1` y no el `width: 160` de antes: ese ancho fijo existia
    // para dejarle sitio al boton "..." que habia a la derecha. Sin el
    // boton, un ancho fijo solo puede recortar el titulo en el idioma
    // en que no quepa.
    flex: 1,
    paddingLeft: 0,
    alignItems: 'flex-start',
  },
});

export const listStyles = StyleSheet.create({
  listContainer: {
    width: '100%',
    backgroundColor: colors[white][0],
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 'auto',
    borderRadius: 15,
  },
  listItemContainer: {
    // backgroundColor: 'red',
    flex: 1,
    minWidth: 70,
    maxWidth: 75,
    height: 75,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  activeItemContainer: {
    width: 55,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  // Algo mas grande que `activeItemContainer` porque este recuadro SI
  // lleva borde y etiqueta dentro; 62 deja ~6px de aire a cada lado
  // dentro de la celda de 75 y el punteado no toca al vecino.
  moreItemContainer: {
    width: 62,
    height: 62,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors[primary][0],
    borderStyle: 'dashed',
  },
  moreLabel: {
    marginTop: 3,
    paddingHorizontal: 2,
  },
});

// Se compara por NOMBRE de icono, no por id. El id de `IIcon` solo vive en
// memoria y ahora hay dos fuentes que lo asignan —los 16 fijos de
// `@data/icons` y el catalogo completo, que numera por posicion en el juego
// de FontAwesome—, asi que el mismo icono podia llegar con dos ids
// distintos y no marcarse como elegido. El nombre es lo unico que se
// guarda en la base y lo unico que identifica un icono de verdad.
export const selectedIconColor = (name: string, selectedIconName?: string) =>
  selectedIconName === name ? colors[accent][0] : colors[gray][1];

export const activeItemContainerStyle = (
  name: string,
  selectedIconName?: string,
) =>
  StyleSheet.flatten([
    listStyles.activeItemContainer,
    {
      backgroundColor:
        selectedIconName === name ? colors[accent][1] : 'transparent',
    },
  ]);
