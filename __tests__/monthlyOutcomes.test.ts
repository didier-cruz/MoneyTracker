/**
 * Las reglas que deciden que se celebra. Se prueban aqui porque casi
 * ninguna se puede provocar a mano en el emulador: harian falta meses
 * de historial real para ver una racha, un promedio o un mes cerrado.
 */
import {
  buildMonthOutcomes,
  buildRolloverSuggestions,
  buildStreaks,
  findImprovements,
  getLimitVerdict,
} from '@screens/AchievementsScreen/monthlyOutcomes';

const cat = (id: number, name: string): ICategory => ({
  id,
  name,
  icon: 'tag',
  type: 'expense',
});

const budget = (period: string, id: number, name: string, limit: number, spent: number) => ({
  period,
  category: cat(id, name),
  limitAmount: limit,
  spent,
});

const spend = (period: string, id: number, name: string, spent: number) => ({
  period,
  category: cat(id, name),
  spent,
});

// Congelado: "hoy" es octubre, asi que septiembre es el ultimo mes cerrado.
const NOW = new Date(2026, 9, 15);

describe('getLimitVerdict', () => {
  it('cumple solo si hubo gasto', () => {
    expect(getLimitVerdict({limitAmount: 15000, spent: 12000})).toBe('met');
    expect(getLimitVerdict({limitAmount: 15000, spent: 15000})).toBe('met');
    expect(getLimitVerdict({limitAmount: 15000, spent: 15001})).toBe('exceeded');
    // La regla que evita felicitar por una categoria sin usar.
    expect(getLimitVerdict({limitAmount: 15000, spent: 0})).toBe('inactive');
  });
});

describe('findImprovements', () => {
  const history = [
    spend('2026-09', 1, 'Despensa', 30000),
    spend('2026-08', 1, 'Despensa', 50000),
    spend('2026-07', 1, 'Despensa', 40000),
  ];

  it('detecta la bajada frente al promedio de los meses previos', () => {
    const [improvement] = findImprovements(history, '2026-09');
    expect(improvement.baseline).toBe(45000);
    expect(improvement.savedAmount).toBe(15000);
    expect(improvement.baselineMonths).toBe(2);
  });

  it('ignora bajadas menores al 10%', () => {
    const flat = [spend('2026-09', 1, 'A', 9900), spend('2026-08', 1, 'A', 10000)];
    expect(findImprovements(flat, '2026-09')).toEqual([]);
  });

  it('no cuenta un mes sin gasto como mejora', () => {
    const gone = [spend('2026-08', 1, 'A', 10000), spend('2026-07', 1, 'A', 10000)];
    expect(findImprovements(gone, '2026-09')).toEqual([]);
  });

  it('no inventa ceros en los huecos: salta el mes sin datos', () => {
    // Sin gasto en agosto. Si agosto contara como 0, el promedio caeria
    // a 5000 y septiembre (8000) pareceria un empeoramiento.
    const gap = [spend('2026-09', 1, 'A', 8000), spend('2026-07', 1, 'A', 10000)];
    const [improvement] = findImprovements(gap, '2026-09');
    expect(improvement.baseline).toBe(10000);
    expect(improvement.baselineMonths).toBe(1);
  });

  it('sin meses previos no hay con que comparar', () => {
    expect(findImprovements([spend('2026-09', 1, 'A', 100)], '2026-09')).toEqual([]);
  });
});

describe('buildMonthOutcomes', () => {
  it('resume el mes y deja fuera el mes en curso', () => {
    const rows = [
      budget('2026-10', 1, 'Despensa', 50000, 10000),
      budget('2026-09', 1, 'Despensa', 50000, 30000),
      budget('2026-09', 2, 'Combustible', 15000, 18000),
      budget('2026-09', 3, 'Regalos', 5000, 0),
    ];
    const outcomes = buildMonthOutcomes(rows, [], NOW);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].period).toBe('2026-09');
    expect(outcomes[0].metCount).toBe(1);
    expect(outcomes[0].exceededCount).toBe(1);
    expect(outcomes[0].inactiveCount).toBe(1);
    // Solo cuenta lo que sobro en los CUMPLIDOS.
    expect(outcomes[0].underBy).toBe(20000);
  });

  it('un mes sin limites entra igual si hubo mejoras', () => {
    const history = [
      spend('2026-09', 1, 'Super', 10000),
      spend('2026-08', 1, 'Super', 30000),
    ];
    const outcomes = buildMonthOutcomes([], history, NOW);
    expect(outcomes.map(o => o.period)).toEqual(['2026-09']);
    expect(outcomes[0].improvements).toHaveLength(1);
  });

  it('un mes sin nada que contar no produce tarjeta', () => {
    const history = [spend('2026-08', 1, 'Super', 30000)];
    expect(buildMonthOutcomes([], history, NOW)).toEqual([]);
  });
});

describe('buildStreaks', () => {
  it('cuenta meses cerrados consecutivos cumplidos', () => {
    const rows = [
      budget('2026-09', 1, 'Combustible', 15000, 12000),
      budget('2026-08', 1, 'Combustible', 15000, 14000),
      budget('2026-07', 1, 'Combustible', 15000, 11000),
    ];
    expect(buildStreaks(rows, NOW).get(1)?.months).toBe(3);
  });

  it('un mes sin limite corta la racha', () => {
    const rows = [
      budget('2026-09', 1, 'C', 15000, 12000),
      // agosto no existe
      budget('2026-07', 1, 'C', 15000, 11000),
    ];
    expect(buildStreaks(rows, NOW).get(1)?.months).toBe(1);
  });

  it('un mes sin gasto corta la racha, no la prolonga', () => {
    const rows = [
      budget('2026-09', 1, 'C', 15000, 12000),
      budget('2026-08', 1, 'C', 15000, 0),
      budget('2026-07', 1, 'C', 15000, 11000),
    ];
    expect(buildStreaks(rows, NOW).get(1)?.months).toBe(1);
  });

  it('sin racha no hay entrada', () => {
    const rows = [budget('2026-09', 1, 'C', 15000, 90000)];
    expect(buildStreaks(rows, NOW).has(1)).toBe(false);
  });
});

describe('buildRolloverSuggestions', () => {
  const rows = [
    budget('2026-09', 1, 'Despensa', 50000, 56037),
    budget('2026-09', 2, 'Combustible', 15000, 12000),
    budget('2026-09', 3, 'Regalos', 5000, 0),
  ];

  it('repite lo cumplido y sube lo excedido al gasto real redondeado', () => {
    const suggestions = buildRolloverSuggestions(rows, NOW);
    const byName = Object.fromEntries(suggestions.map(s => [s.category.name, s]));
    expect(byName.Combustible.suggestedAmount).toBe(15000);
    expect(byName.Combustible.basedOn).toBe('met');
    // 56037 centavos -> $561.00
    expect(byName.Despensa.suggestedAmount).toBe(56100);
    expect(byName.Despensa.basedOn).toBe('exceeded');
    expect(byName.Regalos.suggestedAmount).toBe(5000);
    expect(byName.Regalos.basedOn).toBe('inactive');
  });

  it('no propone nada si el mes en curso ya tiene limites', () => {
    const withCurrent = [...rows, budget('2026-10', 1, 'Despensa', 50000, 0)];
    expect(buildRolloverSuggestions(withCurrent, NOW)).toEqual([]);
  });

  it('no propone nada sin historial', () => {
    expect(buildRolloverSuggestions([], NOW)).toEqual([]);
  });
});
