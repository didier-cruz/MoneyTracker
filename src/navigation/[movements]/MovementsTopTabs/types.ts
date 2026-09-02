export type MovementsTopTabsParams = {
  /**
   * Nombres deliberadamente distintos de los de sus pantallas y de la
   * pestana que los contiene: `Movements > MovementsHome >
   * AccountsTab` en vez de repetir `Accounts`, que es lo que provocaba
   * el aviso de react-navigation sobre pantallas homonimas anidadas.
   */
  AccountsTab: undefined;
  CategoriesTab: undefined;
};
