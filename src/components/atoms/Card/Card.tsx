import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import {CardBodyProps, CardProps} from './types';

// `@redshank/native`'s light-theme `borderRadius.card` / `colors.card`
// tokens — this app's `ThemeProvider` override (`themeLight.colors`)
// never touches the `card` color key, so it stayed this exact value
// everywhere.
const BORDER_RADIUS = 20;
const BACKGROUND_COLOR = '#ffffff';

const CardBody: FC<CardBodyProps> = ({children, style}) => (
  <View style={[styles.body, style]}>{children}</View>
);

interface CardComponent extends FC<CardProps> {
  Body: typeof CardBody;
}

/**
 * Drop-in replacement for `@redshank/native`'s `Card` + `Card.Body`,
 * covering the subset of its API this app actually uses — every call
 * site passes only `style` on `Card` and always nests a `Card.Body`
 * (see this slice's HANDOFF for the measured survey). No `isPressable`
 * variant: the old one injected a `Ripple` with
 * `pointerEvents="box-only"` that silently swallowed nested touches
 * (see `CatalogCard`'s own doc comment, which already works around it)
 * — callers that need a press need to wrap this `Card` in their own
 * touchable instead, same as `CatalogCard` already does.
 *
 * Intentionally has NO default elevation/shadow: the original library
 * never applied one either (its `Card.js` never sets `elevation` or
 * any `shadow*` property by default), only `borderRadius` + background
 * color — the two call sites that DO look elevated (`EnvelopeCard`,
 * `CatalogCard`) get it entirely from their own `style` override
 * (`elevation: 10`), which this component still honors since `style`
 * is applied last. Baking in a default would have added a shadow to
 * the two call sites that never had one (`TransactCard`, `TransactList`).
 */
const CardBase: FC<CardProps> = ({children, style}) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const Card = CardBase as CardComponent;
Card.Body = CardBody;

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS,
    backgroundColor: BACKGROUND_COLOR,
  },
  body: {
    width: '100%',
  },
});
