/**
 * Migracion 7 — tabla `app_meta`.
 *
 * Un par clave/valor para tareas que deben ejecutarse UNA sola vez por
 * instalacion y que no pueden vivir en una migracion.
 *
 * Su primer uso es la siembra de categorias por defecto
 * (`seedDefaultCategoriesOnce`), que necesita el idioma activo de
 * i18next para poner los nombres en el idioma del usuario. Una
 * migracion no sirve para eso: sus sentencias son SQL fijo, y la unica
 * siembra que se hizo asi —la 003, en ingles— acabo borrada a mano por
 * el usuario y sustituida por categorias en espanol.
 *
 * Por que en la base y no en AsyncStorage: si se limpia el
 * almacenamiento pero el fichero de la base sobrevive, un indicador en
 * AsyncStorage haria resucitar categorias que el usuario borro a
 * proposito. Guardado aqui, el indicador y los datos que describe viajan
 * y se borran juntos siempre.
 */
export const migration007Statements: string[] = [
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );`,
];

export default migration007Statements;
