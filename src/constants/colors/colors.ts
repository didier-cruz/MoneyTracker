export const colors = {
  white: ['white'],
  gray: ['#7B7B7B', '#333333'],
  // [0] fondo índigo de la tarjeta "Disponible". [1] texto secundario
  // legible sobre [0] — las etiquetas de los mini-stats (Ingresos/
  // Gastos/Ahorros) del prototipo aprobado, un lavanda-gris apagado
  // (`#9C9AC8`), distinto del lima de la etiqueta principal
  // ("Disponible", que sí usa `accent[0]` — ese es el rótulo destacado,
  // este es el secundario).
  primary: ['#010062', '#9C9AC8'],
  secondary: ['#CF0A0A'],
  tertiary: ['#DC5F00'],
  // [0] claro, [1] medio, [2] fuerte, [3] profundo — [3] existe para texto
  // legible sobre [0]: #5CA41B sobre #C7FF70 da 2,4:1, insuficiente.
  accent: ['#C7FF70', '#8CC63F', '#5CA41B', '#2E4A0C'],
  success: ['#50B700'],
  // [0] never referenced anywhere in this app (kept, unused, in case a
  // future info-toned surface wants it). [1] `@redshank/native`'s
  // `ThemeProvider`-level `info` color (`themeLight` never overrode
  // it, so this is Redshank's own default) — `CatalogCard`'s selected-
  // account cyan border, the one `useTheme()` color this app read with
  // no equivalent already in this file. Migrated verbatim (exact hex,
  // not an approximation) when `useTheme` was retired.
  info: ['#969696', '#0BB7E3'],
  warning: ['#E6BF5C'],
  // [0] el rojo de la app. [1] el MISMO rojo al 70% de luminosidad,
  // para cuando el fondo es la lima `accent[1]`: sobre ese verde el
  // `[0]` se queda en 3.00:1 y estos importes van en 16 negrita, que no
  // cuenta como texto grande, asi que necesitan 4.5. El [1] da 4.85:1.
  // Derivado, no elegido a ojo: `#BC2424` multiplicado por 0.7.
  error: ['#BC2424', '#831919'],
  inactive: ['#EEEEEE'],
  surface: ['#FAFAFA'],
  black: ['black'],
  // Feedback dialogs (`ActionSheet`/`ConfirmDialog`/`BottomSheet`, see
  // `src/components/organisms/feedback`) — the design that replaced
  // native `Alert.alert` calls across the app specified these exact
  // values, none of which matched an existing token. [0] translucent
  // backdrop behind a sheet/dialog. [1] hairline row divider
  // (`ActionSheet` rows) — NOT `gray[0]`, too dark for a 1px hairline.
  // [2] the sheet's drag handle.
  overlay: ['rgba(18,17,46,0.45)', '#F5F5FA', '#E4E4EC'],
  // Same feedback-dialog spec, same reasoning as `overlay` above. [0]
  // heading/title text (`ActionSheet` header, `ConfirmDialog` title) —
  // one shade darker than `gray[1]`'s `#333333`, close enough that
  // reusing `gray` would've blurred two distinct tokens into one.
  // [1] muted indigo-gray body copy (`ConfirmDialog` message).
  text: ['#373737', '#4A4869'],
};

export type ColorType = keyof typeof colors;

export const black: ColorType = 'black';
export const white: ColorType = 'white';
export const primary: ColorType = 'primary';
export const secondary: ColorType = 'secondary';
export const tertiary: ColorType = 'tertiary';
export const accent: ColorType = 'accent';
export const gray: ColorType = 'gray';
export const surface: ColorType = 'surface';
export const inactive: ColorType = 'inactive';
export const overlay: ColorType = 'overlay';
export const text: ColorType = 'text';
