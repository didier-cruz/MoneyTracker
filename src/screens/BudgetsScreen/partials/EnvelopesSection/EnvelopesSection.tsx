import {FC} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {IEnvelopeWithBalance} from '@db/queries';
import {accent, colors, gray, inactive, primary, secondary, white} from '@constants/colors/colors';
import {EnvelopeCard} from '../EnvelopeCard/EnvelopeCard';
import {LoadStatus} from '@hooks/useBudgetsScreen';
import {useTranslation} from 'react-i18next';

interface EnvelopesSectionProps {
  envelopes: IEnvelopeWithBalance[];
  status: LoadStatus;
  errorMessage: string;
  onRetry: () => void;
  onPressEnvelope: (envelope: IEnvelopeWithBalance) => void;
  onPressAdd: () => void;
}

// Mirrors `ScreenContainer`'s own `paddingHorizontal` and `EnvelopeCard`'s
// own `touchable.marginLeft` (applied once per card, including the
// first) — duplicated here rather than imported, since neither exports
// its spacing as a constant.
const SCREEN_HORIZONTAL_PADDING = 15;
/** Separacion entre tarjetas; vive en el `gap` del contenedor, no en
 * el margen de cada tarjeta (ver `EnvelopeCard.styles.touchable`). */
const CARD_GAP = 20;
// Never smaller than `CatalogCard`'s own square account card, never
// larger than this card's original flat width (a tablet's much wider
// screen shouldn't stretch two envelope cards absurdly wide).
/**
 * Aire vertical DENTRO del contenido de la lista, para que quepa la
 * sombra de las tarjetas (`EnvelopeCard` usa `elevation: 10`). Sin esto
 * el contenido mide exactamente lo que miden las tarjetas y la sombra se
 * recorta arriba y abajo: se veia a los lados pero no en vertical.
 */
const CARD_SHADOW_PADDING = 12;
const MIN_CARD_WIDTH = 150;
const MAX_CARD_WIDTH = 190;

/**
 * "Sobres" — the fund/debt envelope cards, side by side, in their own
 * horizontal scroll (same idiom `CatalogList` already uses for
 * accounts). Not a `FragmentSection`-style combined component:
 * envelopes have no per-item "selected -> show a list below" behavior
 * the way accounts do (see `EnvelopeCard`'s doc comment), so there is
 * nothing else this section needs to coordinate besides its own
 * loading/error/empty states.
 *
 * The empty state is a full-width card with its own "Create envelope"
 * button rather than just the trailing add-card from the (in that
 * case, otherwise-empty) horizontal list — a totally empty horizontal
 * `FlatList` reads as a blank sliver of screen on a fresh install, not
 * an inviting empty state.
 */
export const EnvelopesSection: FC<EnvelopesSectionProps> = ({
  envelopes,
  status,
  errorMessage,
  onRetry,
  onPressEnvelope,
  onPressAdd,
}) => {
  const {t} = useTranslation();

  // Sized so exactly two envelope cards sit fully side by side, never
  // clipped by the screen's right edge — the approved prototype lays
  // "Sobres" out as two `flex-grow` cards filling the row, not a
  // horizontally scrolling list; this keeps the SAME idiom
  // `CatalogList`'s accounts already use (a fixed-width horizontal
  // `FlatList`, so a third+ envelope still scrolls in) while making
  // that fixed width responsive to the device's actual screen width,
  // instead of a flat `170` that only happened to fit some devices —
  // see this slice's HANDOFF for the exact clipping this replaces.
  const {width: windowWidth} = useWindowDimensions();
  const twoUpWidth =
    (windowWidth - SCREEN_HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;
  const cardWidth = Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, twoUpWidth));

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text size={18} bold>
          {t('budgets.envelopesHeading')}
        </Text>
        <Text color={colors[gray][0]} size={12}>
          {t('budgets.envelopesSubtitle')}
        </Text>
      </View>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('budgets.loadingEnvelopes')}
          />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <Text color={colors[secondary][0]} style={styles.message}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('budgets.retryLoadingEnvelopes')}
            onPress={onRetry}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && envelopes.length === 0 && (
        <View style={styles.emptyCard}>
          <Text color={colors[gray][0]} style={styles.message}>
            {t('budgets.envelopesEmptyState')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('budgets.createFirstEnvelope')}
            onPress={onPressAdd}
            style={styles.createButton}>
            <Text color={colors[white][0]}>{t('budgets.createEnvelope')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && envelopes.length > 0 && (
        <FlatList
          data={envelopes}
          keyExtractor={item => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({item}) => (
            <EnvelopeCard
              envelope={item}
              cardWidth={cardWidth}
              onPress={() => onPressEnvelope(item)}
            />
          )}
          ListFooterComponent={
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('budgets.createNewEnvelope')}
              onPress={onPressAdd}
              style={styles.addCard}>
              <View style={styles.addIcon}>
                <VectorIcon name="plus" color={colors[primary][0]} size={20} />
              </View>
              <Text color={colors[gray][0]} size={12}>
                {t('budgets.addEnvelope')}
              </Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    width: '100%',
    // Menor que el resto de secciones a proposito: el `paddingVertical`
    // del contenido de la lista ya aporta su propia separacion abajo.
    marginBottom: 2,
  },
  // Sin inset propio: la pantalla ya aporta su padding, igual que en
  // Balance, Cuentas y Analisis.
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    // Idem arriba: el padding del contenido de la lista ya separa el
    // encabezado de las tarjetas.
    marginBottom: 0,
  },
  // El margen negativo saca la lista del padding de la pantalla para que
  // pueda desplazarse hasta el borde; el padding del contenido devuelve
  // el espaciado de los extremos.
  list: {
    marginHorizontal: -SCREEN_HORIZONTAL_PADDING,
  },
  listContent: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingVertical: CARD_SHADOW_PADDING,
    gap: CARD_GAP,
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    height: 44,
    minWidth: 120,
    borderRadius: 10,
    backgroundColor: colors[secondary][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    marginTop: 10,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors[white][0],
    elevation: 4,
    alignItems: 'center',
  },
  createButton: {
    marginTop: 15,
    height: 44,
    minWidth: 170,
    borderRadius: 10,
    backgroundColor: colors[primary][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCard: {
    width: 100,
    height: 170,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors[inactive][0],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors[inactive][0],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
});

export default EnvelopesSection;
