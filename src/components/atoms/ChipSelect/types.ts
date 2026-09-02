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
  testID?: string;
};
