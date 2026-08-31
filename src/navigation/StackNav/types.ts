export type StackNavParams = {
  Dashboard: undefined;
  Form: undefined;
  /**
   * Administrar categorias. Vive en ESTE stack, no en el menu lateral:
   * se entra desde la grilla de categorias del formulario, asi que su
   * boton de volver tiene un destino real (el formulario) en vez de ser
   * la raiz de una rama del drawer.
   */
  Categories: undefined;
};
