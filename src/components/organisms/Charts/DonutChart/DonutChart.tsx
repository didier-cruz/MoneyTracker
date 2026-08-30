import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {Text} from '@redshank/native';
import {colors, gray} from '@constants/colors/colors';
import {IChartSector} from './donutMath';

export interface DonutChartProps {
  /** From `buildDonutData(...).sectors` — already positioned/
   * percentaged, see `donutMath.ts`. Rendering an EMPTY array here is
   * the caller's responsibility to avoid (show an empty state
   * instead, see `AnalysisPieCard`) — this component does not itself
   * decide "is there anything to chart", it just draws whatever it is
   * given, including a single 100% sector. */
  sectors: IChartSector[];
  /** Outer diameter, px. Defaults to `146` — the approved prototype's
   * donut size. */
  size?: number;
  /** Ring thickness, px. Defaults to `28`, wide enough to read as a
   * "donut" (not a thin ring) while still leaving `size - 2*strokeWidth`
   * of clear space in the middle for `centerLabel`/`centerValue`. */
  strokeWidth?: number;
  /** Small label ABOVE the center value, e.g. `"Total"` — 11px, gray,
   * per the approved prototype. */
  centerLabel: string;
  /** The bold amount BELOW `centerLabel`, e.g. `"$1,234.00"` — 21px,
   * bold, per the approved prototype. */
  centerValue: string;
  /** Screen-reader summary for the whole chart — the ring itself is a
   * decorative SVG to a screen reader (same call `CashFlowChart` makes
   * for its bars); `Legend`'s own per-row `accessible` rows carry the
   * per-sector detail, this label is the one-shot overview a
   * VoiceOver/TalkBack user gets on first landing on the chart. */
  accessibilityLabel: string;
}

const DEFAULT_SIZE = 146;
const DEFAULT_STROKE_WIDTH = 28;

/**
 * A donut chart drawn directly with `react-native-svg` — NOT
 * `react-native-gifted-charts`'s own `PieChart`, even though that
 * library is already a dependency used elsewhere in this app
 * (`CashFlowChart`'s bars). See `AnalysisScreen`'s HANDOFF for the full
 * reasoning; the short version: the approved prototype's legend lives
 * OUTSIDE the donut (color chip + name + amount·percentage, to the
 * chart's right), never as a label drawn ON a slice — which is
 * specifically the part of gifted-charts a previous slice found
 * unreliable (mis-positioned in-slice labels on some data shapes, see
 * `organisms/Charts/PieChart`'s existing, unrelated component, kept
 * as-is/untouched here). Since this design never needed slice labels
 * at all, drawing the ring directly sidesteps that failure mode
 * entirely, and keeps every angle/percentage computed by THIS app's
 * own `donutMath.ts` (see its doc comment for the rounding guarantee)
 * instead of trusting a third-party layout engine's internal math.
 *
 * ## The stacked-circle technique
 *
 * Each sector is one full-circle `<Circle>` stroke, made to look like
 * only ITS arc by `strokeDasharray={[sectorArcLength, restOfCircle]}`
 * (a dash exactly as long as the sector's share of the circumference,
 * then a gap covering the rest) plus `strokeDashoffset={-precedingArcLength}`
 * (shifts where that dash starts drawing, so each sector's dash begins
 * exactly where the previous one's ended). The whole `<Svg>` is
 * rotated `-90deg` around its center so the first sector starts at 12
 * o'clock, matching the prototype, and matching how a clock/compass
 * reads sectors clockwise from the top.
 *
 * `strokeLinecap="butt"` (never `"round"`) is the one property this
 * technique cannot work without: a round cap extends visually PAST the
 * mathematical arc length on both ends, which is exactly what would
 * carve a sliver of visible gap into the NEXT sector's start (or, for
 * a single 100% sector, a seam where the same circle's own start and
 * end overlap-and-round instead of meeting flush) — "butt" caps end
 * exactly at the computed length, so adjacent sectors' edges always
 * meet with no gap and no overlap, for any sector count from 1 up.
 */
export const DonutChart: FC<DonutChartProps> = ({
  sectors,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  centerLabel,
  centerValue,
  accessibilityLabel,
}) => {
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      style={{width: size, height: size}}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors[gray][0]}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.15}
        />
        {sectors.map(sector => {
          const arcLength = (sector.sweepAngleDeg / 360) * circumference;
          return (
            <Circle
              key={sector.id}
              cx={center}
              cy={center}
              r={radius}
              stroke={sector.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={`${arcLength} ${circumference - arcLength}`}
              strokeDashoffset={-((sector.startAngleDeg / 360) * circumference)}
              // Rotate THIS ring around the shared center so every
              // sector's angle is measured from 12 o'clock, clockwise —
              // done per-circle (not once on the whole `<Svg>`) so the
              // rotation origin can be the exact `(center, center)`
              // pixel regardless of any future `size` change.
              rotation={-90}
              origin={`${center}, ${center}`}
            />
          );
        })}
      </Svg>

      <View style={styles.centerContent} pointerEvents="none">
        <Text color={colors[gray][0]} size={11} align="center">
          {centerLabel}
        </Text>
        <Text bold size={21} align="center">
          {centerValue}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
});

export default DonutChart;
