import {FC} from 'react';
import {Platform, Text as RNText} from 'react-native';
import {TextProps, TextSize} from './types';

// Copied verbatim from `@redshank/native`'s `fontSizes` theme token —
// see `types.ts`'s own doc comment for why this isn't re-derived from
// anything dynamic.
const FONT_SIZES: Record<TextSize, number> = {
  tiny: 9,
  xxs: 12,
  xs: 14,
  base: 16,
  sm: 18,
  md: 20,
  lg: 22,
  xl: 24,
  xxl: 32,
};

// `@redshank/native`'s `regular`/`bold` font tokens both use this same
// per-platform family (only `fontWeight` differs between them) — see
// its `Context/theme/fonts.js`. Matching it keeps glyphs identical
// (iOS explicitly renders Helvetica, not the system SF default, under
// the old library).
const FONT_FAMILY = Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif';

// `@redshank/native`'s light-theme `colors.text` — this app's
// `ThemeProvider` override (`themeLight.colors`) never touches that
// key, so it stayed this exact value in every screen.
const DEFAULT_COLOR = '#333333';

/**
 * Drop-in replacement for `@redshank/native`'s `Text`, covering the
 * subset of its API this app actually uses (`color`, `style`, `size`,
 * `lines`, `align`, `fontWeight`, `bold`) — see this slice's HANDOFF
 * for the measured call-site survey.
 *
 * Renders the RN `Text` directly, with NO wrapping `View` — the old
 * library wrapped its `Text` in one and split styling across two props
 * (`style` on the inner text node, `containerStyle` on the outer
 * `View`), which is exactly what made `width: '100%'` land on the
 * wrong node at the one call site that needed it (see
 * `Transfer.tsx`'s `explainerContainer` comment, since fixed to apply
 * `style` directly). No other call site used `containerStyle`, and a
 * bare `Text` sizes itself identically to an unstyled wrapping `View`
 * in every layout this app has (both shrink-wrap to content by
 * default), so dropping the wrapper removes a footgun without
 * changing any existing layout.
 */
export const Text: FC<TextProps> = ({
  size = 'base',
  color = DEFAULT_COLOR,
  bold = false,
  fontWeight,
  align,
  transform = 'none',
  lines,
  numberOfLines,
  style,
  ...rest
}) => {
  const fontSize = typeof size === 'number' ? size : FONT_SIZES[size];

  return (
    <RNText
      // `lines` wins if both are passed, matching the alias's own doc
      // in `types.ts` — but unlike the original library, passing ONLY
      // the standard `numberOfLines` now actually works.
      numberOfLines={lines ?? numberOfLines}
      {...rest}
      style={[
        {
          fontFamily: FONT_FAMILY,
          fontSize,
          fontWeight: fontWeight ?? (bold ? 'bold' : 'normal'),
          color,
          textAlign: align,
          textTransform: transform === 'none' ? undefined : transform,
        },
        style,
      ]}
    />
  );
};
