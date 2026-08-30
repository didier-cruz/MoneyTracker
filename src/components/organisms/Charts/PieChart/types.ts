// This file has no imports/exports, so TS treats it as ambient/global; PieChartProps
// is consumed globally by PieChart.tsx without an explicit import.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PieChartProps {
  data: any;
  radius: number;
  items: SelectOptions[];
}
