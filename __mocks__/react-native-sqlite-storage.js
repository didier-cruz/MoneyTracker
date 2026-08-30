/**
 * Mock de react-native-sqlite-storage.
 *
 * Jest usa automaticamente los mocks de node_modules que viven en un __mocks__
 * adyacente a node_modules, sin necesidad de jest.mock() en cada test.
 *
 * La libreria real necesita el modulo nativo de SQLite, inexistente en Node.
 * Este doble devuelve result sets vacios y `user_version = 0`, que es lo que
 * `createTables` espera de una base recien creada: corre las migraciones
 * pendientes contra un executeSql que no persiste nada.
 */
const buildResultSet = (items = []) => ({
  rows: {
    length: items.length,
    item: index => items[index],
    raw: () => items,
  },
  insertId: 1,
  rowsAffected: items.length,
});

const createMockDatabase = () => ({
  executeSql: jest.fn(async query =>
    /PRAGMA user_version/i.test(query)
      ? [buildResultSet([{user_version: 0}])]
      : [buildResultSet()],
  ),
  close: jest.fn(async () => {}),
  transaction: jest.fn(async callback => callback?.({executeSql: jest.fn()})),
});

module.exports = {
  enablePromise: jest.fn(),
  DEBUG: jest.fn(),
  openDatabase: jest.fn(async () => createMockDatabase()),
  deleteDatabase: jest.fn(async () => {}),
};
