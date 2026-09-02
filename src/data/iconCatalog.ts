import FontAwesome from 'react-native-vector-icons/FontAwesome';

/**
 * Catalogo de iconos para elegir al crear una categoria, una cuenta o un
 * sobre.
 *
 * Todo lo que se pinta aqui son nombres de FontAwesome 4.7, el juego que
 * trae `react-native-vector-icons`, porque es el MISMO que usan todas las
 * pantallas que muestran un icono ya guardado (`CategoryTile`,
 * `EnvelopeCard`, `TransactItem`, `AccountSelector`...). La base de datos
 * guarda solo ese nombre como texto, asi que cualquier icono de este
 * catalogo se dibuja en el resto de la app sin tocar nada mas.
 *
 * Antes solo habia 16 iconos fijos en `@data/icons`. Aqui hay 182
 * agrupados por tema, y la busqueda del selector recorre ademas los 786
 * del juego completo, asi que ninguno queda fuera de alcance.
 *
 * No se anade ninguna dependencia: la fuente y su tabla de glifos ya
 * viajaban en la app.
 */
export type IconGroupKey = 'money' | 'home' | 'shopping' | 'food' | 'transport' | 'health' | 'leisure' | 'work' | 'tech' | 'people' | 'travel' | 'other';

export type IconGroup = {
  /** Clave de traduccion: `icons.groups.<key>` en los JSON de i18n. */
  key: IconGroupKey;
  icons: string[];
};

export const ICON_GROUPS: IconGroup[] = [
  {
    key: 'money',
    icons: [
      'money',
      'usd',
      'eur',
      'gbp',
      'jpy',
      'btc',
      'credit-card',
      'credit-card-alt',
      'cc-mastercard',
      'bank',
      'university',
      'line-chart',
      'bar-chart',
      'pie-chart',
      'area-chart',
      'calculator',
      'balance-scale',
      'percent',
      'exchange',
      'handshake-o',
      'tachometer',
    ],
  },
  {
    key: 'home',
    icons: [
      'home',
      'bed',
      'lightbulb-o',
      'wrench',
      'key',
      'plug',
      'shower',
      'bath',
      'tint',
      'fire',
      'fire-extinguisher',
      'snowflake-o',
      'thermometer-half',
      'trash-o',
      'recycle',
      'leaf',
      'tree',
      'paint-brush',
      'unlock-alt',
      'cogs',
    ],
  },
  {
    key: 'shopping',
    icons: [
      'shopping-cart',
      'shopping-basket',
      'shopping-bag',
      'cart-plus',
      'tags',
      'tag',
      'gift',
      'barcode',
      'qrcode',
      'truck',
      'cube',
      'cubes',
      'archive',
      'scissors',
      'diamond',
      'magic',
      'ticket',
    ],
  },
  {
    key: 'food',
    icons: [
      'cutlery',
      'coffee',
      'beer',
      'glass',
      'birthday-cake',
      'lemon-o',
      'apple',
    ],
  },
  {
    key: 'transport',
    icons: [
      'car',
      'automobile',
      'bus',
      'train',
      'subway',
      'taxi',
      'plane',
      'bicycle',
      'motorcycle',
      'ship',
      'rocket',
      'road',
      'map-signs',
      'anchor',
      'paper-plane',
    ],
  },
  {
    key: 'health',
    icons: [
      'heartbeat',
      'medkit',
      'stethoscope',
      'ambulance',
      'user-md',
      'hospital-o',
      'h-square',
      'flask',
      'thermometer',
      'wheelchair',
      'wheelchair-alt',
      'eyedropper',
      'plus-square',
      'hourglass-half',
    ],
  },
  {
    key: 'leisure',
    icons: [
      'futbol-o',
      'gamepad',
      'music',
      'film',
      'camera',
      'camera-retro',
      'headphones',
      'trophy',
      'puzzle-piece',
      'tv',
      'play-circle',
      'microphone',
      'video-camera',
    ],
  },
  {
    key: 'work',
    icons: [
      'briefcase',
      'graduation-cap',
      'book',
      'laptop',
      'building',
      'building-o',
      'industry',
      'folder',
      'folder-open',
      'file-text-o',
      'clipboard',
      'pencil',
      'envelope',
      'envelope-o',
      'fax',
      'id-card-o',
      'sitemap',
      'print',
    ],
  },
  {
    key: 'tech',
    icons: [
      'mobile',
      'desktop',
      'tablet',
      'wifi',
      'television',
      'hdd-o',
      'database',
      'cloud',
      'server',
      'code',
      'keyboard-o',
      'signal',
    ],
  },
  {
    key: 'people',
    icons: [
      'child',
      'users',
      'user',
      'user-circle',
      'user-plus',
      'paw',
      'heart',
      'heart-o',
      'female',
      'male',
      'group',
      'address-book-o',
      'smile-o',
      'street-view',
    ],
  },
  {
    key: 'travel',
    icons: [
      'suitcase',
      'map',
      'map-marker',
      'map-pin',
      'globe',
      'compass',
      'umbrella',
      'binoculars',
      'hotel',
      'sun-o',
      'moon-o',
    ],
  },
  {
    key: 'other',
    icons: [
      'star',
      'star-o',
      'flag',
      'bell',
      'bookmark',
      'calendar',
      'calendar-check-o',
      'clock-o',
      'lock',
      'shield',
      'life-ring',
      'magnet',
      'bolt',
      'eye',
      'cog',
      'hashtag',
      'bullseye',
      'info-circle',
      'check-circle',
      'question-circle',
    ],
  },
];

/** Todos los iconos curados, en el orden en que se muestran. */
export const CURATED_ICON_NAMES: string[] = ICON_GROUPS.flatMap(
  group => group.icons,
);

/**
 * Los 786 nombres del juego completo, para la busqueda. Se leen de la
 * tabla de glifos que la propia libreria ya expone en runtime, en vez de
 * duplicar el JSON: si la libreria cambia de version, esto la sigue.
 */
let allIconNames: string[] | null = null;
export const getAllIconNames = (): string[] => {
  if (allIconNames === null) {
    allIconNames = Object.keys(FontAwesome.getRawGlyphMap()).sort();
  }
  return allIconNames;
};

/**
 * Id numerico estable para un nombre de icono.
 *
 * `IIcon` exige un `id`, pero lo unico que se persiste es el NOMBRE: el id
 * solo vive en memoria mientras el formulario esta abierto. Derivarlo de la
 * posicion en el juego completo lo hace estable entre renders y entre
 * sesiones sin necesidad de una tabla de ids que mantener a mano.
 *
 * Devuelve -1 para un nombre que no existe en el juego, que es lo que ya
 * usaban los formularios para "icono guardado que no reconozco".
 */
export const iconIdFor = (name: string): number => {
  const index = getAllIconNames().indexOf(name);
  return index === -1 ? -1 : index + 1;
};

export const toIcon = (name: string): IIcon => ({id: iconIdFor(name), icon: name});

/**
 * Quita tildes y pasa a minusculas, para que "avion" y "avión" —o "cafe" y
 * "café"— busquen lo mismo.
 */
const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Filtra por texto sobre el juego COMPLETO.
 *
 * Busca en el nombre del icono y, si se le pasa un diccionario de alias, en
 * sus palabras traducidas: los nombres de FontAwesome estan en ingles, asi
 * que sin los alias "casa" o "coche" no encontraban nada con la app en
 * espanol. Los espacios se tratan como guiones para que "credit card"
 * encuentre `credit-card`.
 */
export const searchIconNames = (
  query: string,
  keywords?: Record<string, string>,
): string[] => {
  const needle = normalize(query);
  if (needle === '') {
    return [];
  }
  const hyphenated = needle.replace(/\s+/g, '-');
  return getAllIconNames().filter(name => {
    if (name.includes(hyphenated)) {
      return true;
    }
    const alias = keywords?.[name];
    return alias !== undefined && alias.includes(needle);
  });
};
