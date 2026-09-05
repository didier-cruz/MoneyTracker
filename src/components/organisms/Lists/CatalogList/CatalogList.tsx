import {FC, useEffect, useRef} from 'react';
import {CatalogCard} from '@components/molecules/Cards/CatalogCard';
import {FlatList, StyleSheet} from 'react-native';

/**
 * `ScreenContainer` aplica 15 de padding horizontal a todas las
 * pantallas. Para una lista horizontal eso corta el scroll dentro de
 * ese margen, y las tarjetas se ven recortadas contra un borde
 * invisible en vez de llegar hasta el filo de la pantalla.
 *
 * El margen negativo saca la lista de ese padding; el mismo valor como
 * padding del CONTENIDO devuelve el espaciado inicial y final, asi que
 * las tarjetas siguen empezando donde empezaban.
 */
const SCREEN_HORIZONTAL_PADDING = 15;

const CatalogList: FC<CatalogList> = ({
  data,
  selectedId,
  onPressItem,
  onPressManageItem,
}) => {
  const listRef = useRef<FlatList<CatalogCard>>(null);

  /**
   * Lleva la fila hasta la tarjeta seleccionada cuando la seleccion
   * cambia desde FUERA de la propia fila — es decir, desde la hoja de
   * "ver todas".
   *
   * Sin esto la fila se queda donde el usuario la habia dejado y la
   * tarjeta elegida, que el mapper acaba de poner la primera, queda
   * fuera de pantalla por la izquierda: la seleccion cambia de verdad
   * (los movimientos de abajo responden) pero no se ve marcada en
   * ningun sitio. Comprobado en el emulador.
   *
   * `scrollToIndex` NO sirve aqui: la lista no tiene `getItemLayout` y
   * las tarjetas no miden todas lo mismo (la variante `wide` de una
   * cuenta por cobrar es el doble de ancha), asi que pedir un indice
   * puede fallar con `scrollToIndex out of range`. Para el unico caso
   * que importa —la seleccionada esta la primera— basta con volver al
   * principio.
   */
  useEffect(() => {
    if (selectedId === undefined) {
      return;
    }
    const index = data.findIndex(item => item.id === selectedId);
    if (index === 0) {
      listRef.current?.scrollToOffset({offset: 0, animated: true});
    }
  }, [selectedId, data]);

  return (
    <FlatList
      ref={listRef}
      keyExtractor={item => item.id.toString()}
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      /**
       * `removeClippedSubviews={false}`: en Android va activado por
       * defecto y RECORTA cada celda a sus propios limites. Como la
       * sombra de `CatalogCard` (`elevation: 10`) se dibuja FUERA de la
       * tarjeta, quedaba cortada a los lados en un rectangulo de bordes
       * duros, visible como una costura alrededor de cada tarjeta.
       *
       * El coste de desactivarlo es que las celdas fuera de pantalla
       * siguen montadas: con tres o cuatro cuentas —el caso real de
       * esta lista— no se nota, y a cambio la sombra se ve entera.
       */
      removeClippedSubviews={false}
      style={styles.list}
      contentContainerStyle={styles.content}
      renderItem={({item}) => (
        <CatalogCard
          id={item.id}
          icon={item.icon}
          iconColor={item.iconColor}
          iconBackground={item.iconBackground}
          field={item.field}
          balance={item.balance}
          selectedId={selectedId}
          variant={item.variant}
          onPress={() => onPressItem(item.id)}
          onPressManage={
            onPressManageItem && item.variant !== 'add'
              ? () => onPressManageItem(item.id)
              : undefined
          }
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    marginHorizontal: -SCREEN_HORIZONTAL_PADDING,
  },
  content: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    // Aire vertical para que quepa la sombra de las tarjetas
    // (`CatalogCard` usa `elevation: 10`). Sin el, el contenido mide
    // exactamente lo que miden las tarjetas y la sombra se recorta
    // arriba y abajo. Mismo caso que `EnvelopesSection`.
    paddingVertical: 12,
    // La separacion entre tarjetas vive aqui, no en el margen de cada
    // una: asi la primera queda alineada con el borde del contenido.
    gap: 20,
  },
});

export default CatalogList;
