export const colors = {
  white: ['white'],
  gray: ['#7B7B7B', '#333333'],
  primary: ['#010062'],
  secondary: ['#CF0A0A'],
  tertiary: ['#DC5F00'],
  // [0] claro, [1] medio, [2] fuerte, [3] profundo — [3] existe para texto
  // legible sobre [0]: #5CA41B sobre #C7FF70 da 2,4:1, insuficiente.
  accent: ['#C7FF70', '#8CC63F', '#5CA41B', '#2E4A0C'],
  success: ['#50B700'],
  info: ['#969696'],
  warning: ['#E6BF5C'],
  error: ['#BC2424'],
  inactive: ['#EEEEEE'],
  surface: ['#FAFAFA'],
  black: ['black'],
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
