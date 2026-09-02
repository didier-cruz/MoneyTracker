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
   * Administrar categorias. Vive en ESTE stack, no en el menu lateral:
   * se entra desde la grilla de categorias del formulario, asi que su
   * boton de volver tiene un destino real (el formulario) en vez de ser
   * la raiz de una rama del drawer.
   */
  Categories: undefined;
};
