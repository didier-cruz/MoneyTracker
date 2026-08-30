/**
 * Pure geometry/rounding for a donut chart — no React, no app-specific
 * knowledge (colors/labels are the CALLER's job, see
 * `AnalysisScreen/mappers.ts`). Split out of `DonutChart.tsx` so the
 * math that most often breaks a pie/donut chart (percentages that sum
 * to 99 or 101, sectors that visually gap or overlap) is independently
 * readable/reviewable from the SVG rendering itself.
 *
 * ## The two numbers this file is careful to keep consistent
 *
 * A sector's DRAWN sweep angle (`sweepAngleDeg`, a float) and its
 * DISPLAYED legend percentage (`percentage`, a whole number) are
 * deliberately computed from the SAME underlying ratio
 * (`value / total`), so the legend never disagrees with what the chart
 * actually drew — but they are rounded differently on purpose:
 *
 * - `sweepAngleDeg` keeps full float precision. `DonutChart` draws
 *   sectors back-to-back by literally accumulating each one's own
 *   sweep as the next one's start angle (see `startAngleDeg`), so as
 *   long as every sweep is `(value / total) * 360` with no rounding in
 *   between, the running sum after the last sector is mathematically
 *   exactly `360` (the only drift possible is float epsilon, far below
 *   a visible pixel) — no gap, no overlap, no seam-hiding hack needed.
 * - `percentage` is a WHOLE number for display (nobody wants
 *   "33.333...%" on a legend row) — computed with the "largest
 *   remainder" method (a.k.a. Hamilton's apportionment method) instead
 *   of naive `Math.round` per sector, specifically because naive
 *   rounding is exactly what makes a legend sum to 99 or 101: e.g.
 *   three equal thirds each `Math.round(33.33) = 33` sums to 99, not
 *   100. Largest-remainder gives every sector its floor first, then
 *   hands out the few leftover percentage points (`100 -
 *   sum-of-floors`) one each to the sectors whose rounding lost the
 *   MOST (largest fractional remainder first) — guaranteed to sum to
 *   exactly 100 for any `total > 0`, whole number of sectors.
 */

export interface IChartSectorInput {
  /** Unique per input — envelope `id` in this app's only caller. */
  id: number;
  label: string;
  /** Cents (or any non-negative magnitude) — MUST be `>= 0`. A
   * negative value (e.g. an overdrawn fund, an overpaid debt) is the
   * caller's to clamp/exclude before this function ever sees it; this
   * function has no meaningful way to draw a negative-size sector. */
  value: number;
  color: string;
}

export interface IChartSector extends IChartSectorInput {
  /** Whole number, `0..100`. Every sector's `percentage` in one
   * `buildDonutData` result sums to exactly `100` (see this file's
   * top-of-file doc). */
  percentage: number;
  /** Degrees, `0` = 12 o'clock, increasing CLOCKWISE. Where this
   * sector's arc begins. */
  startAngleDeg: number;
  /** Degrees. How far this sector's arc sweeps from `startAngleDeg`.
   * Every sector's `sweepAngleDeg` in one result sums to `360`
   * (float-exact, see top-of-file doc). */
  sweepAngleDeg: number;
}

export interface IDonutData {
  /** Ordered exactly as `inputs` was passed in — sorting/filtering is
   * the caller's job (see `AnalysisScreen/mappers.ts`'s "biggest slice
   * first" ordering), not this function's. Empty when `total <= 0`. */
  sectors: IChartSector[];
  /** Sum of every input's `value`. `<= 0` means "nothing to chart" —
   * `DonutChart`'s caller is expected to render an empty state instead
   * of an all-zero ring in that case (see `AnalysisPieCard`). */
  total: number;
}

/**
 * Turns raw (id, label, value, color) inputs into fully-positioned,
 * fully-percentaged sectors — the one function BOTH `DonutChart`
 * (drawing) and `Legend` (the "amount · percentage" rows) read from, so
 * the two can never independently drift out of sync with each other.
 *
 * Returns `{sectors: [], total}` (never throws, never divides by zero)
 * when every input is `0` or the list is empty — `total` is still
 * accurate in that case (`0`), just with nothing to slice.
 */
export const buildDonutData = (inputs: IChartSectorInput[]): IDonutData => {
  const total = inputs.reduce((sum, input) => sum + Math.max(0, input.value), 0);

  if (total <= 0 || inputs.length === 0) {
    return {sectors: [], total: Math.max(0, total)};
  }

  const ratios = inputs.map(input => Math.max(0, input.value) / total);
  const rawPercentages = ratios.map(ratio => ratio * 100);
  const flooredPercentages = rawPercentages.map(Math.floor);
  const remainders = rawPercentages.map((raw, index) => raw - flooredPercentages[index]);

  const flooredSum = flooredPercentages.reduce((sum, floored) => sum + floored, 0);
  // Always `>= 0` and `< inputs.length` — each floor is at most 1 below
  // its raw value, so the total shortfall across N sectors is < N.
  let pointsLeftToDistribute = 100 - flooredSum;

  // Largest remainder first; ties broken by larger raw value, then by
  // original input order — both purely deterministic (no `Math.random`,
  // no reliance on sort stability across engines) so the SAME input
  // always produces the SAME percentages, run after run.
  const distributionOrder = inputs
    .map((_, index) => index)
    .sort((a, b) => {
      if (remainders[b] !== remainders[a]) {
        return remainders[b] - remainders[a];
      }
      if (rawPercentages[b] !== rawPercentages[a]) {
        return rawPercentages[b] - rawPercentages[a];
      }
      return a - b;
    });

  const percentages = [...flooredPercentages];
  for (let i = 0; i < distributionOrder.length && pointsLeftToDistribute > 0; i++) {
    percentages[distributionOrder[i]] += 1;
    pointsLeftToDistribute -= 1;
  }

  let cursor = 0;
  const sectors: IChartSector[] = inputs.map((input, index) => {
    const sweepAngleDeg = ratios[index] * 360;
    const sector: IChartSector = {
      ...input,
      value: Math.max(0, input.value),
      percentage: percentages[index],
      startAngleDeg: cursor,
      sweepAngleDeg,
    };
    cursor += sweepAngleDeg;
    return sector;
  });

  return {sectors, total};
};
