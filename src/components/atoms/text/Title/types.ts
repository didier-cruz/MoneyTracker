import {DimensionValue, TextProps as RNTextProps, TextStyle} from 'react-native';

/** `@redshank/native` only ever shipped levels 1–5; this app only ever
 * uses 1–4, but 5 is kept for parity since it's part of the same
 * measured token set (`titleFontSizes`). */
export type TitleLevel = 1 | 2 | 3 | 4 | 5;

export interface TitleProps extends Omit<RNTextProps, 'style'> {
  level?: TitleLevel;
  /** Any valid RN color value. Defaults to the same `#333333`
   * `@redshank/native`'s light theme used for its own default `text`
   * color (see `Text/Text.tsx`'s own doc comment). */
  color?: string;
  align?: TextStyle['textAlign'];
  /** Defaults per `level`, copied verbatim from `@redshank/native`'s
   * `Title` (20/15/10/5/0 for levels 1–5) — several layouts depend on
   * these exact defaults, so they're preserved rather than re-tuned. */
  marginBottom?: DimensionValue;
  style?: RNTextProps['style'];
}
