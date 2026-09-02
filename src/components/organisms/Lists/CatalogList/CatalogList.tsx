import {FC} from 'react';
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
  return (
    <FlatList
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
