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
  /**
   * Editar un movimiento abierto DESDE `AllMovements`.
   *
   * Es la misma pantalla que registra el stack del formulario, pero
   * hace falta aqui tambien: `AllMovements` cuelga de este stack, y
   * desde el la pestana `Outcomes` —donde vive la otra copia— esta en
   * una rama HERMANA, no ancestro. react-navigation resuelve un nombre
   * subiendo por el arbol, nunca bajando a la rama de al lado, asi que
   * navegar alli fallaba con "not handled by any navigator".
   *
   * Registrarla aqui ademas arregla el regreso: al guardar se vuelve a
   * `AllMovements`, que es de donde se vino. Saltando a la pestana el
   * usuario acababa en el formulario de nuevo movimiento, en otro sitio
   * del que habia empezado.
   */
  EditTransaction: {financeId: number};
};
