import {TextProps as RNTextProps, TextStyle} from 'react-native';

/**
 * Named type scale, copied verbatim from `@redshank/native`'s
 * `fontSizes` theme token (see its `Context/theme/defaultValues.js`) —
 * this scale is already assumed by every screen in the app, so this
 * replacement keeps it byte-for-byte instead of inventing a new one.
 */
export type TextSize = 'tiny' | 'xxs' | 'xs' | 'base' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/** Matches `@redshank/native`'s own `TransformType`. */
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** Named size token or a raw pixel number, exactly like
   * `@redshank/native`'s `Text`. Defaults to `base` (16). */
  size?: TextSize | number;
  /** Any valid RN color value (hex, named, rgba…). Defaults to the same
   * `#333333` `@redshank/native`'s light theme used for its own default
   * `text` color (unmodified by this app's `ThemeProvider` override,
   * which never touches that token). */
  color?: string;
  /** Shorthand for `fontWeight: 'bold'` — mirrors `@redshank/native`'s
   * own `bold` prop. Ignored if `fontWeight` is also given. */
  bold?: boolean;
  fontWeight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  /** `textTransform`, matching `@redshank/native`'s own `transform` prop
   * name/values (`uppercase`/`lowercase`/`capitalize`/`none`). */
  transform?: TextTransform;
  style?: RNTextProps['style'];
  /**
   * @deprecated Prefer the standard RN `numberOfLines` — it now works.
   * `@redshank/native`'s own `Text` applied `numberOfLines={lines}`
   * AFTER spreading the rest of its props, so any `numberOfLines` a
   * caller passed was silently clobbered back to `undefined`; the only
   * prop that ever worked was its own non-standard `lines`. This
   * component fixes that (both props now do the same thing — `lines`
   * wins only if both are given) and keeps `lines` solely so the
   * existing call sites don't all need to change in this same pass.
   */
  lines?: number;
}
