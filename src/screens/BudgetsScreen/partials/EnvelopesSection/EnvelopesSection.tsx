import {FC, useMemo, useState} from 'react';
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
import {EnvelopeKind, IEnvelopeWithBalance} from '@db/queries';
import {SegmentedControl, SegmentedControlOption} from '@components/atoms/SegmentedControl';
import {accent, colors, gray, inactive, primary, secondary, white} from '@constants/colors/colors';
import {EnvelopeCard} from '../EnvelopeCard/EnvelopeCard';
import {LoadStatus} from '@hooks/useBudgetsScreen';
import {useTranslation} from 'react-i18next';

/**
 * El filtro de la seccion. `'all'` no es un `EnvelopeKind` —la base
 * solo conoce `'fund'` y `'debt'`— asi que el tipo se amplia aqui, en
 * la capa de presentacion, que es donde "todos" significa algo.
 */
type EnvelopeFilter = EnvelopeKind | 'all';

interface EnvelopesSectionProps {
  envelopes: IEnvelopeWithBalance[];
  status: LoadStatus;
  errorMessage: string;
  onRetry: () => void;
  onPressEnvelope: (envelope: IEnvelopeWithBalance) => void;
  onPressAdd: () => void;
  onPressComplete: (envelope: IEnvelopeWithBalance) => void;
  /** Cuantos logros hay ya. `0` esconde el enlace: un acceso a una
   * pantalla vacia solo sirve para decepcionar. */
  achievementsCount: number;
  onPressAchievements: () => void;
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
 * Lleva su propio filtro Todos/Fondos/Deudas — ver el comentario de
 * `filter` en el cuerpo para por que se resuelve en memoria.
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
  onPressComplete,
  achievementsCount,
  onPressAchievements,
}) => {
  const {t} = useTranslation();

  /**
   * El filtro se resuelve EN MEMORIA, no volviendo a consultar con
   * `getEnvelopes(db, {kind})`.
   *
   * Dos razones. La tabla de sobres es pequena por diseno (lo dice
   * `envelopesQueries.ts` en su propio comentario), asi que la lista
   * completa ya esta cargada y volver a SQL solo anadiria un parpadeo
   * de spinner por cada toque. Y con las dos listas en la mano se puede
   * distinguir "no tienes ningun sobre" de "no tienes sobres de este
   * tipo", que son vacios distintos y quieren mensajes distintos; con
   * una consulta filtrada los dos casos llegan como un array vacio
   * indistinguible.
   */
  const [filter, setFilter] = useState<EnvelopeFilter>('all');
  const visibleEnvelopes = useMemo(
    () => (filter === 'all' ? envelopes : envelopes.filter(envelope => envelope.kind === filter)),
    [envelopes, filter],
  );

  const filterOptions: SegmentedControlOption<EnvelopeFilter>[] = [
    {value: 'all', label: t('budgets.envelopeFilter.all')},
    {value: 'fund', label: t('budgets.envelopeFilter.funds')},
    {value: 'debt', label: t('budgets.envelopeFilter.debts')},
  ];

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
        {achievementsCount > 0 ? (
          // Sustituye a "Dinero apartado" en vez de sumarse: los dos
          // viven en la esquina derecha del mismo encabezado y caben
          // mal juntos en una pantalla estrecha. El enlace gana porque
          // "Dinero apartado" es una etiqueta que no cambia nunca,
          // mientras que esto es el unico camino desde aqui a Logros.
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('budgets.seeAchievementsAccessibilityLabel', {
              count: achievementsCount,
            })}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={onPressAchievements}
            style={styles.achievementsLink}>
            <VectorIcon name="trophy" size={12} color={colors[primary][0]} />
            <Text color={colors[primary][0]} size={12}>
              {t('budgets.seeAchievements', {count: achievementsCount})}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text color={colors[gray][0]} size={12}>
            {t('budgets.envelopesSubtitle')}
          </Text>
        )}
      </View>

      {/* Solo cuando hay sobres: un filtro sobre una lista vacia no
          filtra nada y le roba el sitio al vacio, que es lo unico que
          esa pantalla tiene que decir. Las tres opciones se muestran
          siempre que aparece, aunque una quede en cero — un control
          que cambia de forma segun los datos desorienta mas de lo que
          ahorra. */}
      {status === 'success' && envelopes.length > 0 && (
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={filterOptions}
          // Tres etiquetas cortas caben de sobra en una fila; sin esto
          // la regla automatica las reparte en una rejilla de dos y
          // deja "Deudas" sola en una segunda fila.
          layout="even"
          style={styles.filter}
        />
      )}

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

      {status === 'success' && envelopes.length > 0 && visibleEnvelopes.length === 0 && (
        <View style={styles.filterEmpty}>
          <Text color={colors[gray][0]} style={styles.message}>
            {filter === 'fund'
              ? t('budgets.noFundEnvelopes')
              : t('budgets.noDebtEnvelopes')}
          </Text>
        </View>
      )}

      {status === 'success' && visibleEnvelopes.length > 0 && (
        <FlatList
          // Remontar al cambiar de filtro descarta el desplazamiento
          // horizontal anterior, que es lo correcto: la posicion en la
          // lista de "Todos" no significa nada en la de "Deudas".
          key={filter}
          data={visibleEnvelopes}
          keyExtractor={item => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Mismo motivo que en `CatalogList`: el recorte por celda de
          // Android cortaba la sombra de las tarjetas por los lados.
          removeClippedSubviews={false}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({item}) => (
            <EnvelopeCard
              envelope={item}
              cardWidth={cardWidth}
              onPress={() => onPressEnvelope(item)}
              onPressComplete={onPressComplete}
            />
          )}
          ListFooterComponent={
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('budgets.createNewEnvelope')}
              onPress={onPressAdd}
              style={[styles.addCard, {width: cardWidth}]}>
              <View style={styles.addIcon}>
                <VectorIcon name="plus" color={colors[primary][0]} size={25} />
              </View>
              <Text color="#373737" size={12} style={styles.addLabel}>
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
    // `stretch` para que el envoltorio que `FlatList` pone alrededor del
    // `ListFooterComponent` llegue a la altura de la fila. Sin esto la
    // tarjeta de agregar se quedaba al alto de su contenido (~65 frente
    // a los ~196 de una tarjeta de sobre) y colgaba de la parte de
    // arriba. `alignSelf: 'stretch'` en la tarjeta NO basta: no puede
    // estirar al envoltorio que la contiene, solo a si misma dentro de
    // el. Es inocuo para las tarjetas de sobre, que ya miden todas lo
    // mismo.
    alignItems: 'stretch',
  },
  achievementsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filter: {
    marginTop: 12,
  },
  filterEmpty: {
    width: '100%',
    paddingVertical: 24,
    alignItems: 'center',
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
    // `boxShadow` y no `elevation`: en Android la sombra de `elevation`
    // sigue el contorno RECTANGULAR de la vista y asomaba por las
    // esquinas de las tarjetas redondeadas como un cuadrado gris.
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.10)',
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
  // Estandarizada con la tarjeta de "Agregar cuenta"/"Agregar categoria"
  // (`CatalogCard` variante 'add'): tarjeta solida con la MISMA sombra y
  // el mismo radio que las de datos, no un recuadro punteado mas
  // estrecho. El ancho lo fija `cardWidth` en el render, el mismo que
  // usan las tarjetas de sobre, y `alignSelf: 'stretch'` la deja a la
  // altura de la fila en vez de a un alto fijo que no coincidia con
  // ninguna.
  addCard: {
    // `flex: 1` dentro del envoltorio (que es columna) = ocupa todo su
    // alto, ya estirado por `alignItems: 'stretch'` de arriba.
    flex: 1,
    borderRadius: 20,
    backgroundColor: colors[white][0],
    // `boxShadow` y no `elevation`: en Android la sombra de `elevation`
    // sigue el contorno RECTANGULAR de la vista y asomaba por las
    // esquinas redondeadas como un cuadrado gris.
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    width: 40,
    height: 40,
    // Circular, como el contenedor del icono de `CatalogCard`, no el
    // cuadrado redondeado de 34 que usaba antes.
    borderRadius: 50,
    backgroundColor: colors[inactive][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLabel: {
    marginTop: 10,
    textAlign: 'center',
  },
});

export default EnvelopesSection;
