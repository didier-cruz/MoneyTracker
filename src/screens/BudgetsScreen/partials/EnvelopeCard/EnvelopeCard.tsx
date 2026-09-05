import {FC} from 'react';
import {Money} from '@components/atoms/text/Money';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Card} from '@components/atoms/Card';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faPiggyBank} from '@fortawesome/free-solid-svg-icons/faPiggyBank';
import {faFileInvoiceDollar} from '@fortawesome/free-solid-svg-icons/faFileInvoiceDollar';
import {hasReachedGoal, IEnvelopeWithBalance} from '@db/queries';
import {ProgressBar} from '@components/atoms';
import {accent, colors, gray, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {getEnvelopeProgress} from '../../mappers';
import {getKindLabel} from '../../CreateEnvelope/partials/KindField/KindField';
import {useTranslation} from 'react-i18next';

interface EnvelopeCardProps {
  envelope: IEnvelopeWithBalance;
  /** Computed by `EnvelopesSection` from the device's actual screen
   * width, so exactly two cards fit side by side without the second
   * one being clipped by the screen's right edge — see that
   * component's doc comment for why this isn't a flat constant. */
  cardWidth: number;
  /**
   * The ONLY gesture this card exposes — see this slice's HANDOFF:
   * there is no per-envelope "detail"/"selected" view to switch into
   * (unlike `CatalogCard`'s accounts, which drive a movements list
   * below), so the whole card is one button straight into the
   * assign/withdraw/edit/archive action sheet, rather than reserving a
   * separate small "manage" button for it.
   */
  onPress: () => void;
  /**
   * Se dispara desde el CTA que sustituye a la barra de progreso cuando
   * el sobre llega a su meta. Separado de `onPress` a proposito:
   * completar retira dinero, y esconderlo dentro del mismo gesto que
   * abre el menu de acciones lo volveria pulsable por accidente.
   */
  onPressComplete: (envelope: IEnvelopeWithBalance) => void;
}

const KIND_ICONS = {
  fund: faPiggyBank,
  debt: faFileInvoiceDollar,
};

// Fixed per kind, not per envelope — the approved prototype shows a
// uniform "chip" treatment, distinguishing fund vs debt only by its
// icon/label, not a whole per-envelope color scheme. `fund` stays the
// existing solid `accent[1]` wash (confirmed against the prototype —
// already correct); `debt` was solid indigo (`colors.primary[0]`), the
// prototype's chip icon box is red AT ~18% ALPHA (`rgba(188,36,36,0.18)`)
// — `${hex}2E` is the same "append an alpha hex byte" idiom
// `TransactItem` already uses for ITS icon background (`${color}33`,
// ~20%), `2E` (46/255 ≈ 18%) matching the prototype's exact alpha here.
const KIND_CHIP_BACKGROUND = {
  fund: colors[accent][1],
  debt: `${colors.error[0]}2E`,
};

// The chip icon GLYPH color: `fund`'s solid, opaque `accent[1]`
// background keeps enough contrast for a white glyph (unchanged,
// matches the prototype's own white-on-solid treatment elsewhere in
// this app's icon chips). `debt`'s background above is now a PALE red
// wash, not solid — a white glyph would go near-invisible on it, so it
// switches to the same red as the background's base color, matching
// the prototype's own red-stroke icon.
const KIND_ICON_COLOR = {
  fund: colors[white][0],
  debt: colors.error[0],
};

// Progress bar / balance color per kind — a `debt`'s progress and
// amount render in the app's error red (the prototype's own red for a
// debt card), a `fund`'s in the app's success green (the prototype's
// own green) — NOT the fixed `colors.success[0]` this used to hard-code
// for every kind, which painted a debt's own bar green.
const KIND_ACCENT_COLOR = {
  fund: colors.success[0],
  debt: colors.error[0],
};

/**
 * One "Sobre" card — see `BudgetsScreen`'s doc comment for the approved
 * layout this implements (radius 20, elevation, type chip, name,
 * balance as `Title level={2}`, 6px progress bar, context line).
 * Progress math/wording is entirely `getEnvelopeProgress`'s
 * responsibility (see `mappers.ts`) — this component only renders
 * whatever it returns, including hiding the bar for a goal-less fund.
 */
export const EnvelopeCard: FC<EnvelopeCardProps> = ({
  envelope,
  cardWidth,
  onPress,
  onPressComplete,
}) => {
  const {t} = useTranslation();
  const {hasProgress, ratio, contextLine} = getEnvelopeProgress(envelope);
  const kindLabel = getKindLabel(envelope.kind);
  const accentColor = KIND_ACCENT_COLOR[envelope.kind];
  // La MISMA funcion que decide si la escritura se aceptaria (ver
  // `hasReachedGoal` en `envelopesQueries`). Calcularlo aparte aqui
  // permitiria ofrecer el boton justo cuando la consulta lo rechazaria.
  const reachedGoal = hasReachedGoal(envelope);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('budgets.envelopeCardAccessibilityLabel', {
        name: envelope.name,
        kind: kindLabel,
        balance: formatCentsToCurrency(envelope.balance),
        context: contextLine,
      })}
      accessibilityHint={t('budgets.envelopeCardAccessibilityHint')}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.touchable}>
      <Card style={[styles.card, {width: cardWidth}, reachedGoal && styles.cardComplete]}>
        <Card.Body style={styles.body}>
          <View style={styles.chipRow}>
            <View
              style={[
                styles.chipIcon,
                {backgroundColor: KIND_CHIP_BACKGROUND[envelope.kind]},
              ]}>
              <FontAwesomeIcon
                icon={KIND_ICONS[envelope.kind]}
                color={KIND_ICON_COLOR[envelope.kind]}
                size={16}
              />
            </View>
            {/* Uppercase + letter-spacing + per-kind color, per the
                approved prototype — was gray, lowercase, uniform. */}
            <Text
              color={accentColor}
              size={11}
              transform="uppercase"
              style={styles.chipLabel}>
              {kindLabel}
            </Text>
            {reachedGoal && (
              <Text
                color={colors[accent][3]}
                size={10}
                bold
                transform="uppercase"
                style={styles.goalBadge}>
                {t('budgets.goalReachedBadge')}
              </Text>
            )}
          </View>

          <Text lines={1} style={styles.name}>
            {envelope.name}
          </Text>
          <Title level={2} color={envelope.kind === 'debt' ? accentColor : undefined}>
            {<Money cents={envelope.balance} fontSize={25} />}
          </Title>

          {/* Al llegar a la meta, el CTA SUSTITUYE a la barra y a la
              linea de contexto: una barra al 100% y un "100% pagado" ya
              no informan de nada, y son justo el sitio donde el usuario
              esta mirando cuando quiere cerrar el sobre. */}
          {reachedGoal ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('budgets.completeEnvelopeAccessibilityLabel', {
                name: envelope.name,
              })}
              onPress={() => onPressComplete(envelope)}
              style={styles.completeButton}>
              <Text color={colors[accent][3]} size={12} bold align="center">
                {t('budgets.markComplete')}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {hasProgress && (
                <ProgressBar
                  progress={ratio}
                  height={6}
                  color={accentColor}
                  style={styles.progress}
                  accessibilityLabel={contextLine}
                />
              )}
          {/* Was capped at `lines={1}` — es-ES's longer "X% pagado ·
              quedan $Y" (vs en-US's shorter equivalent) truncates
              mid-amount at this card's width (see this slice's
              HANDOFF). Wrapping to 2 lines keeps the full sentence
              readable without touching the translated copy itself or
              widening the card back into the overflow this same slice
              fixes above. */}
              <Text color={colors[gray][0]} size={11} lines={2}>
                {contextLine}
              </Text>
            </>
          )}
        </Card.Body>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Sin margen propio: la separacion entre tarjetas la da el `gap` del
  // contenedor de la lista, para que la PRIMERA quede alineada con el
  // encabezado "Sobres" en vez de 20 mas adentro.
  touchable: {},
  card: {
    borderRadius: 20,
    // `boxShadow` y no `elevation`: en Android la sombra de `elevation`
    // sigue el contorno RECTANGULAR de la vista y asomaba por las
    // esquinas de las tarjetas redondeadas como un cuadrado gris.
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.14)',
  },
  // El borde lima es lo que hace reconocible un sobre cumplido dentro de
  // la fila horizontal sin tener que leer porcentajes. Va con
  // `borderWidth` sobre el mismo radio, no con una sombra de color: en
  // Android una sombra tenida se recorta cuadrada en las esquinas, el
  // mismo problema que ya obligo a cambiar `elevation` por `boxShadow`
  // en todas las tarjetas de esta app.
  cardComplete: {
    borderWidth: 2,
    borderColor: colors[accent][1],
  },
  body: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chipIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chipLabel: {
    flexShrink: 1,
    letterSpacing: 0.7,
  },
  goalBadge: {
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  completeButton: {
    marginTop: 12,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors[accent][0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginBottom: 2,
  },
  progress: {
    marginTop: 8,
    marginBottom: 6,
  },
});

export default EnvelopeCard;
