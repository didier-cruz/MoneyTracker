import {Card} from '@components/atoms/Card';
import {Money} from '@components/atoms/text/Money';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {FC} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {formatCentsToCurrency} from '@utils/currency';
import {colors as tokens} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

const CatalogCard: FC<CatalogCard> = ({
  id,
  icon,
  iconColor,
  field,
  balance,
  onPress,
  onPressManage,
  iconBackground,
  selectedId,
  variant = 'square',
}) => {
  const {t} = useTranslation();
  const isActive = selectedId === id;
  const isNegative = balance < 0;
  const isWide = variant === 'wide';
  const isAdd = variant === 'add';
  const showManageButton = !isAdd && !!onPressManage;

  const accessibilityLabel = isAdd
    ? field
    : t('accounts.catalogCardAccessibilityLabel', {
        name: field,
        balance: formatCentsToCurrency(balance),
      });

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected: !isAdd && isActive}}
      // The whole card is one merged accessibility element (`accessible`
      // above) — a screen-reader user cannot separately focus the small
      // "manage" button nested inside it (see below), so its action is
      // exposed here instead, reachable from VoiceOver's rotor /
      // TalkBack's local-context menu without needing a second stop.
      accessibilityActions={
        showManageButton ? [{name: 'manage', label: t('accounts.manageAccountAction')}] : undefined
      }
      onAccessibilityAction={
        showManageButton
          ? event => {
              if (event.nativeEvent.actionName === 'manage') {
                onPressManage();
              }
            }
          : undefined
      }>
      {/*
        NO se usa `isPressable` de Card: inyecta el `Ripple` de
        @redshank/native, que fija `pointerEvents="box-only"` en el
        contenedor de sus hijos y con eso descarta EN SILENCIO cualquier
        toque anidado — el boton "..." de gestionar quedaba muerto. El
        touchable propio conserva la pulsacion de la tarjeta y deja que
        el boton interior reciba la suya.
      */}
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card
        style={[
          styles.card,
          isWide && styles.cardWide,
          // Was `useTheme()`'s `colors.info` (`@redshank/native`'s own
          // default `info` theme color — `themeLight` never overrode
          // it) — migrated verbatim to `tokens.info[1]`, see that
          // token's own doc comment in `@constants/colors/colors`.
          isActive && {borderColor: tokens.info[1], borderWidth: 1.5},
        ]}>
        <Card.Body style={styles.cardBody}>
          <View
            style={[
              styles.cardBodyContnr,
              isWide && styles.cardBodyContnrWide,
              isAdd && styles.cardBodyContnrAdd,
            ]}>
            <View
              style={{...styles.iconContainer, backgroundColor: iconBackground}}>
              <VectorIcon name={icon} color={iconColor} size={25} />
            </View>
            {!isAdd && (
              <View style={isWide ? styles.wideText : undefined}>
                <Text color="#373737" size={12}>
                  {field}
                </Text>
                <Title
                  level={2}
                  color={isNegative ? tokens.error[0] : undefined}>
                  {<Money cents={balance} fontSize={25} />}
                </Title>
              </View>
            )}
            {isAdd && (
              <Text color="#373737" size={12} style={styles.addLabel}>
                {field}
              </Text>
            )}
          </View>
          {showManageButton && (
            // Sighted-user affordance for the same action exposed above
            // as a screen-reader `accessibilityAction` — visually reuses
            // this codebase's existing "more options" idiom (ellipsis in
            // a rounded `accent` chip; see `CategoriesList`'s
            // `AddCategory`/`SymbolList`'s header action). Not part of an
            // approved prototype for this screen — flagged for review.
            <TouchableOpacity
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={onPressManage}
              style={styles.manageButton}>
              <VectorIcon name="ellipsis-h" color={tokens.accent[0]} size={14} />
            </TouchableOpacity>
          )}
        </Card.Body>
      </Card>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // El margen izquierdo se elimino: la separacion entre tarjetas la da
  // ahora el `gap` del contenedor de la lista, para que la PRIMERA quede
  // alineada con el resto de la pantalla en vez de 20 mas adentro.
  // Sin margen vertical propio: el aire de arriba y abajo lo da el
  // `paddingVertical` del contenido de `CatalogList`, que existe para
  // que quepa la sombra de `elevation: 10`. Tener los dos sumaba 32 por
  // lado y era lo que empujaba la lista de movimientos hacia abajo. Lo
  // mismo con el margen derecho de la variante ancha: la separacion
  // entre tarjetas la da el `gap` de la lista, y declararla dos veces
  // dejaba la tarjeta ancha con el doble de hueco a su derecha.
  card: {
    borderRadius: 20,
    // `boxShadow` y NO `elevation`: en Android la sombra de `elevation`
    // se dibuja segun el contorno RECTANGULAR de la vista, asi que
    // asomaba por las cuatro esquinas de la tarjeta redondeada como un
    // cuadrado gris. `boxShadow` (RN 0.76+, nueva arquitectura) sigue el
    // `borderRadius`.
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.14)',
  },
  cardWide: {},
  cardBody: {position: 'relative'},
  cardBodyContnr: {
    width: 150,
    height: 150,
    justifyContent: 'space-around',
    paddingLeft: 20,
    paddingTop: 20,
  },
  cardBodyContnrWide: {
    width: 310,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // La variante 'add' se centra en la tarjeta en vez de heredar el
  // `paddingLeft/Top: 20` + `space-around` de una tarjeta con datos.
  // Ese anclaje arriba-izquierda tiene sentido cuando bajo el icono hay
  // dos lineas (concepto y saldo); con solo un `+` y una etiqueta
  // dejaba la mitad inferior vacia y el simbolo descentrado.
  cardBodyContnrAdd: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 0,
    paddingTop: 0,
  },
  wideText: {
    marginLeft: 20,
  },
  addLabel: {
    marginTop: 10,
    textAlign: 'center',
  },
  iconContainer: {
    height: 40,
    width: 40,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  manageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.accent[1],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CatalogCard;
