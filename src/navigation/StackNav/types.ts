export type StackNavParams = {
  Dashboard: undefined;
  Form: undefined;
  /**
   * Misma pantalla que `Form`, en modo edicion. Es una RUTA APARTE y no
   * un parametro opcional de `Form` a proposito: `Form` es la ruta
   * inicial de este stack y el destino del boton flotante, asi que un
   * `financeId` guardado en sus parametros se quedaria pegado y el
   * siguiente toque al boton abriria la edicion del movimiento
   * anterior en vez de un movimiento nuevo.
   */
  EditTransaction: {financeId: number};
  /**
   * Alta de categoria, empujada desde la grilla del formulario: su
   * boton de volver devuelve al formulario, que es de donde se vino.
   */
  CreateCategory: undefined;
};
