import {StyleSheet, Text} from 'react-native';
import {useTranslation} from 'react-i18next';

type DrawerLabelProps = {
  i18nKey: string;
  color: string;
};

/**
 * `drawerLabel` de react-navigation se invoca como función, no como
 * componente, así que no puede usar hooks. Este componente existe para
 * que la etiqueta se re-renderice al cambiar el idioma en caliente.
 */
export const DrawerLabel = ({i18nKey, color}: DrawerLabelProps) => {
  const {t} = useTranslation();
  // Una sola linea que encoge la fuente antes que partir la palabra:
  // con la fuente del sistema agrandada, "Categorias" salia como
  // "Categoria" / "s". Ver el ancho del menu en `navOptions.ts`.
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      style={[styles.label, {color}]}>
      {t(i18nKey)}
    </Text>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default DrawerLabel;
