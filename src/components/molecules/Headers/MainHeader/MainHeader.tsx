import {StyleSheet, Text, View} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faBarsStaggered} from '@fortawesome/free-solid-svg-icons/faBarsStaggered';
import {faChevronDown} from '@fortawesome/free-solid-svg-icons/faChevronDown';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {ParamListBase, useNavigation} from '@react-navigation/native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
type MainHeaderProps = {
  title?: string;
  /**
   * Second header line, rendered as-is (never split further) — added
   * for `BudgetsScreen`'s "Budgets" / current-month two-line header.
   * Without this, the only way to get a second line was splitting
   * `title` on its first space and keeping just the SECOND word
   * (`title.split(' ')`'s destructure below silently drops everything
   * after that), which mangles any subtitle with more than one word
   * (e.g. `"August 2026"` -> `"August"`, losing the year). Optional and
   * additive: every existing caller that only ever passed `title`
   * (`AccountsScreen`/`ResumenScreen`/`AnalysisScreen`) keeps the exact
   * same split-on-first-space behavior it already had.
   */
  subtitle?: string;
  /**
   * Vuelve el subtitulo TOCABLE y le pone un chevron.
   *
   * Existe para el selector de periodo: la cabecera de estas pantallas
   * ya mostraba el mes ahi, asi que convertirlo en control no cuesta ni
   * un pixel de alto — que es exactamente lo que no sobra.
   *
   * Opcional y aditivo: sin el, el subtitulo se dibuja como siempre,
   * dentro del mismo bloque de texto que el titulo. Con el, se separa en
   * su propia fila tocable; se hace asi y no envolviendo el bloque
   * entero para que el titulo NO quede dentro del area pulsable.
   */
  onPressSubtitle?: () => void;
  /** Etiqueta del subtitulo tocable para lectores de pantalla. */
  subtitleAccessibilityLabel?: string;
};

const MainHeader = ({
  title = '',
  subtitle,
  onPressSubtitle,
  subtitleAccessibilityLabel,
}: MainHeaderProps) => {
  const [title1, splitTitle2] = title.split(' ');
  const title2 = subtitle ?? splitTitle2;

  const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();

  return (
    <View
      style={{
        flexDirection: 'row',
        // Menos aire por DEBAJO que a los lados: los 30 uniformes
        // separaban el titulo de su propio contenido tanto como del
        // borde de la pantalla, y en Movimientos dejaban un hueco
        // grande entre el titulo y sus pestanas.
        paddingHorizontal: 30,
        paddingTop: 30,
        paddingBottom: 12,
        width: '100%',
      }}>
      <TouchableOpacity onPress={() => navigation.openDrawer()}>
        <FontAwesomeIcon
          icon={faBarsStaggered}
          color={'green'}
          size={30}
          style={{marginRight: 30, marginTop: 10}}
        />
      </TouchableOpacity>
      {title && onPressSubtitle && (
        <View style={styles.stackedBlock}>
          <Text {...singleLineFit} style={styles.title1}>
            {title1}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={subtitleAccessibilityLabel ?? title2}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            onPress={onPressSubtitle}
            style={styles.subtitleRow}>
            <Text {...singleLineFit} style={[styles.title2, styles.shrink]}>
              {title2}
            </Text>
            <FontAwesomeIcon
              icon={faChevronDown}
              size={11}
              color={'#333333'}
              style={styles.subtitleChevron}
            />
          </TouchableOpacity>
        </View>
      )}
      {title && !onPressSubtitle && (
        // `stackedBlock` (o sea, `flexShrink: 1`) tambien aqui: sin el,
        // este bloque no tiene ninguna cota de ancho dentro de la fila y
        // un subtitulo largo se sale de la pantalla en vez de partirse.
        // La rama tocable de arriba ya lo tenia; esta se quedo sin ello
        // y el fallo solo asoma con subtitulos largos (Logros: "3 metas
        // cumplidas · $24,000.00").
        // El titulo y el subtitulo van en dos `Text` hermanos y no
        // anidados: solo el titulo se fuerza a una linea. El subtitulo
        // puede ser largo (Logros: "3 metas cumplidas · $24,000.00") y
        // ahi partirse en varias lineas es lo correcto.
        <View style={styles.stackedBlock}>
          <Text {...singleLineFit} style={styles.title1}>
            {title1}
          </Text>
          {title2 && <Text style={styles.title2}>{title2}</Text>}
        </View>
      )}
    </View>
  );
};

/**
 * Una sola linea que encoge la fuente antes que partirse.
 *
 * El titulo va a 36 y, despues del menu y los margenes, le quedan unos
 * 270dp en un telefono de 393dp. En un Xiaomi con la fuente del sistema
 * agrandada, "Presupuestos" ya no cabia y React Native lo partia A MEDIA
 * PALABRA ("Presupuest" / "os"), porque es una sola palabra sin otro
 * punto de corte. Igual con el mes del selector de periodo, que salia
 * en dos lineas ("septiembre de" / "2026") y empujaba el chevron.
 * Reproducido en el emulador con `font_scale 1.15` y densidad 480.
 *
 * `adjustsFontSizeToFit` reduce solo lo necesario, y `minimumFontScale`
 * pone un piso para que nunca quede diminuto.
 */
const singleLineFit = {
  numberOfLines: 1,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.6,
} as const;

const styles = StyleSheet.create({
  shrink: {
    flexShrink: 1,
  },
  stackedBlock: {
    flexShrink: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Sin alto propio: el subtitulo ya ocupaba esta linea cuando iba
    // dentro del bloque de texto, asi que la cabecera no crece.
    alignSelf: 'flex-start',
  },
  subtitleChevron: {
    marginTop: 2,
  },
  title1: {
    color: '#373737',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  title2: {
    color: '#373737',
    fontSize: 24,
    fontWeight: '400',
    textAlign: 'left',
  },
});

export default MainHeader;
