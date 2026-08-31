import {FC} from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {colors, inactive} from '@constants/colors/colors';

interface ProgressBarProps {
  /**
   * Fraction of "done", e.g. `0.6` for 60%. NOT clamped by the caller —
   * this component clamps the FILL width to `[0, 1]` itself (a value
   * over `1` still renders a full bar, never overflowing the track),
   * so callers computing a ratio that can legitimately exceed 100%
   * (an over-limit budget, an over-saved fund) never have to special-
   * case the math themselves before passing it in.
   */
  progress: number;
  /** Track + fill height in px, and also each end's border radius
   * (`height / 2`, a pill shape) — no separate `borderRadius` prop so a
   * caller can never accidentally pass a radius that doesn't match a
   * pill for this height. Defaults to `6` (the envelope card spec). */
  height?: number;
  /** Fill color. Defaults to `colors.success[0]` — callers implementing
   * the green/amber/red budget-limit states (see `BudgetsScreen`)
   * always pass this explicitly instead of relying on the default. */
  color?: string;
  /** Track (background) color. Defaults to `colors.inactive[0]`, this
   * design system's existing neutral "empty" tone (see `KindField`'s
   * `Radio.Group`/`CatalogCard`'s unselected state for the same token
   * used elsewhere as a neutral background). */
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Screen-reader summary for the whole bar, e.g. `"60% of $2,000"` —
   * required, not optional, so a bar is never rendered as a silent
   * decoration; every call site in this slice already has a matching
   * context line to reuse as this label. */
  accessibilityLabel: string;
}

const DEFAULT_HEIGHT = 6;

/**
 * A plain, non-animated horizontal progress bar built directly on
 * design tokens (`@constants/colors/colors`) rather than
 * `@redshank/native`'s own `Progress` (that whole library has since
 * been removed from this app — see the `@redshank/native` removal
 * slice's HANDOFF) — that component resolved its
 * `activeColor`/`fallbackColor` props through `useTheme()`'s OWN color
 * table (`ThemeProvider`'s `success`/`warning`/`error`, formerly wired
 * in `App.tsx` from `src/constants/theme/theme.ts`, both now deleted),
 * which did not match this app's
 * `colors.success`/`colors.warning`/`colors.error` tokens
 * value-for-value (e.g. theme `success` is `#C7FF70`, token `success` is
 * `#50B700`) — passing a raw hex string as `activeColor` would silently
 * fall back to the theme's `primary` instead of rendering that hex, an
 * "use tokens directly, never fall back to something else" spec this
 * slice was explicit about. A small local atom keeps every bar
 * pixel-for-pixel on the same tokens `BudgetsScreen`'s cards/rows
 * already read colors from, no theme indirection in between.
 */
export const ProgressBar: FC<ProgressBarProps> = ({
  progress,
  height = DEFAULT_HEIGHT,
  color = colors.success[0],
  trackColor = colors[inactive][0],
  style,
  accessibilityLabel,
}) => {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {height, borderRadius: height / 2, backgroundColor: trackColor},
        style,
      ]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    minWidth: 0,
  },
});

export default ProgressBar;
