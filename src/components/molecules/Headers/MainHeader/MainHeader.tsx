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
          <Text style={styles.title1}>{title1}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={subtitleAccessibilityLabel ?? title2}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            onPress={onPressSubtitle}
            style={styles.subtitleRow}>
            <Text style={styles.title2}>{title2}</Text>
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
        <View style={styles.stackedBlock}>
          <Text style={styles.title1}>
            {title1}
            {title2 && (
              <Text style={styles.title2}>
                {'\n'}
                {title2}
              </Text>
            )}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
