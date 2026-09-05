/**
 * Categorias que se crean solas en la primera entrada a la app, para que
 * nadie tenga que inventarse sus basicas antes de poder registrar el
 * primer gasto. El CTA "Mas categorias" queda entonces para lo propio de
 * cada uno, no para lo que todo el mundo necesita igual.
 *
 * Cada entrada guarda una CLAVE de traduccion, no un nombre: el nombre
 * se resuelve al sembrar con el idioma activo (ver
 * `seedDefaultCategoriesOnce`). Ojo con lo que eso implica: el nombre se
 * guarda como DATO en `categories.category`, asi que cambiar el idioma
 * de la app despues NO renombra las que ya existen.
 *
 * Los nombres de icono son de FontAwesome 4.7 —el juego que trae
 * `react-native-vector-icons`— y los 22 estan verificados contra su
 * tabla de glifos. Un nombre inexistente no falla: se dibuja un cuadro
 * vacio y nadie se entera.
 *
 * Lo que NO esta aqui, a proposito: `Loan` y `Credit card`, que sembraba
 * la migracion 003. Desde la 006 son TIPOS DE CUENTA (`loan`,
 * `credit_card`), y pagar la tarjeta es una transferencia entre cuentas,
 * no un gasto — tenerlas tambien como categoria hacia contar el mismo
 * dinero dos veces. El interes si es gasto real y lo recoge
 * `feesInterest`.
 */
export type DefaultCategory = {
  /** Clave bajo `defaultCategories.` en los JSON de i18n. */
  key: string;
  /** Nombre de icono de FontAwesome 4.7. */
  icon: string;
  type: 'expense' | 'income';
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // --- Gastos: el nucleo diario ---
  {key: 'groceries', icon: 'shopping-cart', type: 'expense'},
  // Separado del supermercado a proposito: es el gasto que mas se
  // descontrola y mezclarlo con la compra del mes lo esconde.
  {key: 'diningOut', icon: 'cutlery', type: 'expense'},
  {key: 'housing', icon: 'home', type: 'expense'},
  {key: 'utilities', icon: 'lightbulb-o', type: 'expense'},
  {key: 'internetPhone', icon: 'wifi', type: 'expense'},
  {key: 'transport', icon: 'bus', type: 'expense'},
  // Aparte de `transport`: quien tiene coche mira el combustible solo.
  {key: 'fuel', icon: 'car', type: 'expense'},
  {key: 'health', icon: 'heartbeat', type: 'expense'},
  {key: 'pharmacy', icon: 'medkit', type: 'expense'},
  {key: 'education', icon: 'graduation-cap', type: 'expense'},
  {key: 'clothing', icon: 'shopping-bag', type: 'expense'},
  {key: 'leisure', icon: 'film', type: 'expense'},

  // --- Gastos: muy frecuentes ---
  {key: 'subscriptions', icon: 'tv', type: 'expense'},
  {key: 'personalCare', icon: 'scissors', type: 'expense'},
  {key: 'pets', icon: 'paw', type: 'expense'},
  {key: 'gifts', icon: 'gift', type: 'expense'},
  // Sustituye al `Interests` en ingles que sembraba la migracion 006 —
  // ver `LEGACY_INTERESTS_NAME` en `seedQueries.ts`.
  {key: 'feesInterest', icon: 'percent', type: 'expense'},

  // --- Ingresos ---
  {key: 'salary', icon: 'money', type: 'income'},
  {key: 'freelance', icon: 'briefcase', type: 'income'},
  {key: 'rentalIncome', icon: 'key', type: 'income'},
  {key: 'investments', icon: 'line-chart', type: 'income'},
  // Devoluciones y reintegros: sin esto se registran como ingreso y
  // inflan lo que de verdad se gana.
  {key: 'refunds', icon: 'exchange', type: 'income'},
];

export default DEFAULT_CATEGORIES;
