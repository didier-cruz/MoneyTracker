import React from 'react';
import {FlatList} from 'react-native';
import {ScrollContainerProps} from './types';

const EMPTY_DATA: never[] = [];

/**
 * Contenedor con scroll que admite listas virtualizadas anidadas
 * (FlatList/SectionList) sin el aviso de React Native, usando el truco
 * habitual: un FlatList vacio cuyo "header" es todo el contenido.
 *
 * Antes esto venia de `react-native-virtualized-view`, que hace lo
 * mismo PERO pasa el header como componente en linea:
 *
 *   ListHeaderComponent: () => <>{props.children}</>
 *
 * Esa funcion es nueva en cada render, asi que React la trata como un
 * tipo de componente distinto y DESMONTA Y REMONTA todo el subarbol en
 * cada re-render. El sintoma era que el campo de monto perdia el foco
 * tras el primer digito y se cerraba el teclado.
 *
 * Aqui el header se pasa como ELEMENTO, no como componente: React
 * reconcilia por tipo y los hijos conservan su identidad.
 */
export const ScrollContainer = ({children, style, refreshControl}: ScrollContainerProps) => {
  return (
    <FlatList
      style={style}
      data={EMPTY_DATA}
      keyExtractor={(_item, index) => `scroll-${index}`}
      renderItem={null}
      ListHeaderComponent={<>{children}</>}
      showsVerticalScrollIndicator={false}
      // Sin esto, tocar el scroll mientras se escribe cierra el teclado
      // antes de que el toque llegue a su destino.
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    />
  );
};
