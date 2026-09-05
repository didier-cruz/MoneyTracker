/**
 * Las ramas de `toExpenseChartData` que NO se pueden ver en el
 * emulador con datos reales: hacen falta seis categorias con gasto en
 * el mismo tramo para que aparezca "Otros", y una reembolsada a cero
 * para el filtro de sectores vacios. Se verifica aqui porque la
 * funcion es pura — no toca `@db/queries` ni React.
 */
import {toExpenseChartData, OTHERS_SECTOR_ID, buildExpenseInsight} from '@screens/AnalysisScreen/mappers';
import {buildDonutData} from '@components/organisms/Charts/DonutChart';

const row = (id: number, name: string, spent: number) => ({
  category: {id, name, icon: 'tag', type: 'expense' as const},
  spent,
});

describe('toExpenseChartData', () => {
  it('deja 5 sectores propios y suma el resto en Otros', () => {
    const rows = [
      row(1, 'Alquiler', 50000),
      row(2, 'Despensa', 40000),
      row(3, 'Combustible', 30000),
      row(4, 'Restaurantes', 20000),
      row(5, 'Servicios', 10000),
      row(6, 'Ropa', 600),
      row(7, 'Cine', 300),
      row(8, 'Regalos', 100),
    ];
    const {sectors, iconById} = toExpenseChartData(rows);
    expect(sectors).toHaveLength(6);
    const others = sectors[sectors.length - 1];
    expect(others.id).toBe(OTHERS_SECTOR_ID);
    expect(others.value).toBe(1000);
    expect(others.label).toContain('3');
    expect(iconById[OTHERS_SECTOR_ID]).toBe('ellipsis-h');
    expect(new Set(sectors.map(s => s.color)).size).toBe(6);
    const {total, sectors: drawn} = buildDonutData(sectors);
    expect(total).toBe(151000);
    expect(drawn.reduce((s, x) => s + x.percentage, 0)).toBe(100);
  });

  it('no crea Otros con 5 o menos', () => {
    const {sectors} = toExpenseChartData([row(1, 'A', 100), row(2, 'B', 50)]);
    expect(sectors.map(s => s.id)).toEqual([1, 2]);
  });

  it('descarta categorias con gasto neto cero', () => {
    const {sectors} = toExpenseChartData([row(1, 'A', 100), row(2, 'Reembolsada', 0)]);
    expect(sectors).toHaveLength(1);
  });

  it('cambia de frase cuando ninguna categoria domina', () => {
    const spread = toExpenseChartData([
      row(1, 'A', 100), row(2, 'B', 100), row(3, 'C', 100), row(4, 'D', 100), row(5, 'E', 100),
    ]);
    const text = buildExpenseInsight(buildDonutData(spread.sectors).sectors) ?? '';
    expect(text).not.toContain('A');
    expect(buildExpenseInsight([])).toBeNull();
  });
});
