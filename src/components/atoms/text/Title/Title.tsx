import {FC} from 'react';
import {Platform, Text as RNText} from 'react-native';
import {TitleLevel, TitleProps} from './types';

// Copied verbatim from `@redshank/native`'s `titleFontSizes` theme
// token — see its `Context/theme/fonts.js`.
const FONT_SIZES: Record<TitleLevel, number> = {
  1: 30,
  2: 25,
  3: 20,
  4: 18,
  5: 16,
};

// Copied verbatim from `@redshank/native`'s `Title` own per-level
// default `marginBottom` (see its `Title.js`) — several layouts depend
// on these exact values.
const MARGIN_BOTTOM: Record<TitleLevel, number> = {
  1: 20,
  2: 15,
  3: 10,
  4: 5,
  5: 0,
};

// Same family `@redshank/native` used for its own `bold` font token
// (see `Text/Text.tsx`'s own doc comment) — `Title` always renders bold.
const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif';

const DEFAULT_COLOR = '#333333';

// `Title` always renders bold — kept as a named constant (rather than
// the literal inline) so it reads as one of this component's fixed
// tokens alongside `FONT_SIZES`/`MARGIN_BOTTOM`/`FONT_FAMILY` above.
const FONT_WEIGHT = 'bold' as const;

/**
 * Drop-in replacement for `@redshank/native`'s `Title`, covering the
 * subset of its API this app actually uses (`level`, `style`,
 * `numberOfLines`, `color`, `marginBottom`) — see this slice's HANDOFF
 * for the measured call-site survey. Renders the RN `Text` directly
 * (the original never wrapped `Title` in an extra `View`, so there's
 * no wrapper decision to make here, unlike `Text`).
 *
 * `numberOfLines` already worked on the original `Title` (unlike its
 * sibling `Text`) since it never destructured it out before spreading
 * — this component keeps that working the same way.
 */
export const Title: FC<TitleProps> = ({
  level = 1,
  color = DEFAULT_COLOR,
  align,
  marginBottom,
  style,
  ...rest
}) => {
  return (
    <RNText
      {...rest}
      style={[
        {
          marginBottom: marginBottom ?? MARGIN_BOTTOM[level],
          fontSize: FONT_SIZES[level],
          fontFamily: FONT_FAMILY,
          fontWeight: FONT_WEIGHT,
          color,
          textAlign: align,
        },
        style,
      ]}
    />
  );
};
