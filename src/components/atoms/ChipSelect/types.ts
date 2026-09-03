export type ChipSelectOption<T extends string> = {
  value: T;
  label: string;
};

export type ChipSelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ChipSelectOption<T>[];
  /** Etiqueta del campo, sobre la fila de chips. */
  label?: string;
  /**
   * Fila en scroll horizontal en vez de envolver a varias lineas.
   *
   * Para un filtro cuyas opciones son DATOS —una cuenta, una categoria—
   * el numero de chips no se conoce de antemano: envolviendo, veinte
   * categorias se comen media pantalla antes de llegar al contenido.
   * En scroll ocupan siempre una fila.
   */
  scrollable?: boolean;
  testID?: string;
};
