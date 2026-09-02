export type HomeNavParams = {
  /** El navegador de pestanas. Se llama `RootNav` desde antes; no se
   * renombra para no romper los `navigate` que ya lo referencian. */
  RootNav: undefined;
  /**
   * Todos los movimientos, POR ENCIMA de las pestanas: al empujarse
   * cubre tambien la barra inferior. Los parametros pre-aplican el
   * filtro del sitio desde el que se entro (una cuenta, una categoria)
   * — ver `AllMovementsScreen`.
   */
  AllMovements: {idAccount?: number; idCategory?: number} | undefined;
};
