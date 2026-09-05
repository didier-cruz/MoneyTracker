import {IBudgetOutcomeRow, IMonthlyCategorySpending} from '@db/queries';
import {currentMonth, shiftMonth} from '@utils/periodSelection';

/**
 * Como cerro cada mes: los limites que se cumplieron, los que se
 * pasaron, y las categorias en las que se gasto menos que antes.
 *
 * Todo puro y sin React: se alimenta de lo que ya trajeron
 * `getAllCategoryBudgetsWithSpent` y `getMonthlySpendingByCategory`.
 * Las reglas de este archivo son las que deciden que se celebra, asi
 * que estan cubiertas por `__tests__/monthlyOutcomes.test.ts` — varias
 * dependen de combinaciones de datos que no se pueden provocar a mano
 * en el emulador.
 */

export type LimitVerdict = 'met' | 'exceeded' | 'inactive';

export interface ILimitOutcome {
  category: ICategory;
  limitAmount: number;
  spent: number;
  verdict: LimitVerdict;
  /** Cents. Positivo = lo que sobro; negativo = lo que se paso. `0` en
   * un limite sin actividad. */
  delta: number;
}

export interface ISpendingImprovement {
  category: ICategory;
  /** Cents gastados este mes. */
  spent: number;
  /** Cents: la referencia con la que se compara. */
  baseline: number;
  /** Cents ahorrados frente a la referencia. Siempre `> 0`. */
  savedAmount: number;
  /**
   * Cuantos meses previos formaron la referencia. `1` significa "menos
   * que el mes pasado"; `2` o mas, "menos que tu promedio". La UI elige
   * la frase con esto — llamar "promedio" a un solo mes seria mentir.
   */
  baselineMonths: number;
}

export interface IMonthOutcome {
  /** `'YYYY-MM'`. */
  period: string;
  limits: ILimitOutcome[];
  metCount: number;
  exceededCount: number;
  inactiveCount: number;
  /** Cents: suma de lo que sobro en los limites CUMPLIDOS. */
  underBy: number;
  improvements: ISpendingImprovement[];
}

/**
 * Cuantos meses previos como mucho entran en la referencia de una
 * mejora. Tres y no "todo el historial" porque lo que se quiere medir
 * es un cambio de habito reciente: un gasto de hace dos anos no dice
 * nada sobre si este mes gastaste menos de lo normal PARA TI hoy.
 */
const BASELINE_MONTHS = 3;

/**
 * Cuanto hay que bajar para que cuente como mejora: un 10% de la
 * referencia.
 *
 * Sin un minimo, cualquier mes con un dolar de diferencia produciria un
 * "logro", y una pantalla que celebra el ruido deja de significar nada.
 * Es un porcentaje y no una cantidad fija porque bajar $5 en una
 * categoria de $40 es un cambio real y en una de $2,000 es la nada.
 */
const MIN_IMPROVEMENT_RATIO = 0.1;

/**
 * El veredicto de UN limite.
 *
 * `inactive` —limite con CERO gasto— es la regla que mas importa aqui, y
 * no es un tecnicismo: si "no gastar nada" contara como cumplido, un
 * limite puesto sobre una categoria que nunca se usa produciria una
 * felicitacion todos los meses, y a los tres meses el usuario deja de
 * creerse la pantalla entera. Un limite solo se cumple si hubo algo que
 * contener.
 */
export const getLimitVerdict = (row: {limitAmount: number; spent: number}): LimitVerdict => {
  if (row.spent <= 0) {
    return 'inactive';
  }
  return row.spent <= row.limitAmount ? 'met' : 'exceeded';
};

const toLimitOutcome = (row: IBudgetOutcomeRow): ILimitOutcome => {
  const verdict = getLimitVerdict(row);
  return {
    category: row.category,
    limitAmount: row.limitAmount,
    spent: row.spent,
    verdict,
    delta: verdict === 'inactive' ? 0 : row.limitAmount - row.spent,
  };
};

/**
 * Las mejoras de UN mes: categorias en las que se gasto
 * significativamente menos que en los meses inmediatamente anteriores.
 *
 * Dos exclusiones deliberadas:
 *
 * - **Un mes sin gasto no es una mejora.** Si la categoria no aparece en
 *   `period`, no se compara: no usar una categoria no es lo mismo que
 *   gastar menos en ella, y tratarlo como logro premiaria dejar de
 *   registrar movimientos.
 * - **Se salta los huecos.** La referencia son los ultimos
 *   `BASELINE_MONTHS` meses EN LOS QUE HUBO GASTO, no los tres meses
 *   naturales anteriores. Meter un mes sin datos como un cero hundiria
 *   el promedio y convertiria cualquier mes normal en una "mejora".
 */
export const findImprovements = (
  history: IMonthlyCategorySpending[],
  period: string,
): ISpendingImprovement[] => {
  const byCategory = new Map<number, IMonthlyCategorySpending[]>();
  for (const row of history) {
    const list = byCategory.get(row.category.id) ?? [];
    list.push(row);
    byCategory.set(row.category.id, list);
  }

  const improvements: ISpendingImprovement[] = [];
  for (const rows of byCategory.values()) {
    const thisMonth = rows.find(row => row.period === period);
    if (thisMonth === undefined) {
      continue;
    }
    const previous = rows
      .filter(row => row.period < period)
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, BASELINE_MONTHS);
    if (previous.length === 0) {
      continue;
    }
    const baseline = Math.round(
      previous.reduce((sum, row) => sum + row.spent, 0) / previous.length,
    );
    const savedAmount = baseline - thisMonth.spent;
    if (savedAmount <= 0 || savedAmount < baseline * MIN_IMPROVEMENT_RATIO) {
      continue;
    }
    improvements.push({
      category: thisMonth.category,
      spent: thisMonth.spent,
      baseline,
      savedAmount,
      baselineMonths: previous.length,
    });
  }

  return improvements.sort((a, b) => b.savedAmount - a.savedAmount);
};

/**
 * Un `IMonthOutcome` por mes que tenga ALGO que contar — limites o
 * mejoras —, del mas reciente al mas antiguo, y **sin el mes en curso**.
 *
 * El mes en curso queda fuera por una razon y no por prudencia: todavia
 * no ha cerrado. Un limite que hoy va por la mitad no es un logro, es
 * una foto a mitad de partido, y meterlo en la lista de logros
 * significaria que la tarjeta cambia de veredicto sola segun avanza el
 * mes. Lo que va del mes actual se ve en Presupuestos, que es donde
 * corresponde.
 */
export const buildMonthOutcomes = (
  budgetRows: IBudgetOutcomeRow[],
  history: IMonthlyCategorySpending[],
  now: Date = new Date(),
): IMonthOutcome[] => {
  const thisMonth = currentMonth(now);

  const periods = new Set<string>();
  for (const row of budgetRows) {
    periods.add(row.period);
  }
  for (const row of history) {
    periods.add(row.period);
  }

  const outcomes: IMonthOutcome[] = [];
  for (const period of [...periods].sort((a, b) => b.localeCompare(a))) {
    if (period >= thisMonth) {
      continue;
    }
    const limits = budgetRows.filter(row => row.period === period).map(toLimitOutcome);
    const improvements = findImprovements(history, period);
    if (limits.length === 0 && improvements.length === 0) {
      continue;
    }
    const met = limits.filter(limit => limit.verdict === 'met');
    outcomes.push({
      period,
      limits,
      metCount: met.length,
      exceededCount: limits.filter(limit => limit.verdict === 'exceeded').length,
      inactiveCount: limits.filter(limit => limit.verdict === 'inactive').length,
      underBy: met.reduce((sum, limit) => sum + limit.delta, 0),
      improvements,
    });
  }
  return outcomes;
};

export interface ICategoryStreak {
  category: ICategory;
  /** Meses CERRADOS consecutivos cumpliendo el limite, `>= 1`. */
  months: number;
}

/**
 * Rachas por categoria: cuantos meses cerrados seguidos se ha cumplido
 * el limite, contando hacia atras desde el mes cerrado mas reciente.
 *
 * Dos decisiones:
 *
 * - **Un mes sin limite CORTA la racha**, no la salta. No se puede
 *   presumir de haber respetado un limite que no existia.
 * - **Un mes `inactive` tambien la corta.** Por la misma razon que no
 *   cuenta como logro: un mes sin gasto no demuestra contencion. Dejarlo
 *   pasar permitiria rachas construidas a base de meses vacios.
 *
 * Cuenta desde el mes anterior al actual: el mes en curso no ha cerrado
 * y no puede sumar a una racha todavia.
 */
export const buildStreaks = (
  budgetRows: IBudgetOutcomeRow[],
  now: Date = new Date(),
): Map<number, ICategoryStreak> => {
  const byCategoryPeriod = new Map<string, ILimitOutcome>();
  const categories = new Map<number, ICategory>();
  for (const row of budgetRows) {
    byCategoryPeriod.set(`${row.category.id}:${row.period}`, toLimitOutcome(row));
    categories.set(row.category.id, row.category);
  }

  const streaks = new Map<number, ICategoryStreak>();
  for (const [categoryId, category] of categories) {
    let months = 0;
    let period = shiftMonth(currentMonth(now), -1);
    // Sin tope artificial: la cadena se corta sola en el primer mes sin
    // limite, y `category_budgets` no puede tener mas filas que meses
    // haya usado la app.
    for (;;) {
      const outcome = byCategoryPeriod.get(`${categoryId}:${period}`);
      if (outcome === undefined || outcome.verdict !== 'met') {
        break;
      }
      months += 1;
      period = shiftMonth(period, -1);
    }
    if (months > 0) {
      streaks.set(categoryId, {category, months});
    }
  }
  return streaks;
};

export interface IRolloverSuggestion {
  /** El mes del que se copian. */
  fromPeriod: string;
  category: ICategory;
  idCategory: number;
  /** Cents que se propone poner en el mes nuevo. */
  suggestedAmount: number;
  /** El limite que tenia en `fromPeriod`. */
  previousAmount: number;
  /** `'met'` -> se repite tal cual; `'exceeded'` -> se sube al gasto
   * real; `'inactive'` -> se repite, no hubo nada que aprender. */
  basedOn: LimitVerdict;
}

/**
 * Que limites proponer para el mes en curso cuando todavia no tiene
 * ninguno, a partir del ultimo mes cerrado que si los tuvo.
 *
 * El importe sugerido NO es siempre una copia:
 *
 * - Limite cumplido -> se repite. Funciono.
 * - Limite excedido -> se sube AL GASTO REAL de ese mes, redondeado a
 *   dolares. Repetir un limite que ya se demostro corto es entrenar al
 *   usuario a ignorar la app; subirlo al gasto real da una meta que
 *   puede cumplir, y a partir de ahi bajar. La pantalla dice de donde
 *   sale el numero, no lo cambia a escondidas.
 * - Limite sin actividad -> se repite, porque no hay nada que aprender
 *   de un mes en el que esa categoria no se uso.
 *
 * Devuelve `[]` si el mes en curso YA tiene limites: la tarjeta de
 * arrastre solo tiene sentido sobre un mes vacio.
 */
export const buildRolloverSuggestions = (
  budgetRows: IBudgetOutcomeRow[],
  now: Date = new Date(),
): IRolloverSuggestion[] => {
  const thisMonth = currentMonth(now);
  if (budgetRows.some(row => row.period === thisMonth)) {
    return [];
  }
  const previousPeriods = [...new Set(budgetRows.map(row => row.period))]
    .filter(period => period < thisMonth)
    .sort((a, b) => b.localeCompare(a));
  const source = previousPeriods[0];
  if (source === undefined) {
    return [];
  }

  return budgetRows
    .filter(row => row.period === source)
    .map(row => {
      const verdict = getLimitVerdict(row);
      // Redondeo HACIA ARRIBA al dolar: un limite de $560.37 se lee como
      // un numero salido de una maquina, no como una decision.
      const suggestedAmount =
        verdict === 'exceeded' ? Math.ceil(row.spent / 100) * 100 : row.limitAmount;
      return {
        fromPeriod: source,
        category: row.category,
        idCategory: row.category.id,
        suggestedAmount,
        previousAmount: row.limitAmount,
        basedOn: verdict,
      };
    });
};
