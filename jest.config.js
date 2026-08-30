module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // AsyncStorage es un módulo nativo: en Node no existe. La librería
  // publica su propio mock oficial, que es preferible a escribir uno.
  // Hace falta desde que `src/i18n` persiste el idioma elegido.
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
  // El preset de RN solo transpila react-native y @react-native*. Todo paquete
  // de node_modules que se publique como ESM/TS sin transpilar tiene que
  // listarse aqui o Jest lo cargara crudo y fallara con un SyntaxError.
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      [
        '(jest-)?react-native',
        '@react-native[^/]*',
        '@react-navigation',
        'react-native-[^/]+',
        '@redshank/native',
        'gifted-charts-core',
        '@fortawesome/react-native-fontawesome',
        '@mobile-reality/react-native-select-pro',
      ].join('|') +
      ')/)',
  ],
};
