module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@components': './src/components',
          '@constants': './src/constants',
          '@data': './src/data',
          '@hooks': './src/hooks',
          '@test': './src/modules/test',
          '@assets': './src/assets',
          '@context': './src/context',
          '@api': './src/api',
          '@screens': './src/screens',
          '@utils': './src/utils',
          '@icons': './src/assets/icons',
          '@navigation': './src/navigation',
          '@db': './src/db',
        },
      },
    ],
    [
      'react-native-reanimated/plugin',
      {
        relativeSourceLocation: true,
        loose: true,
      },
    ],
    ['@babel/plugin-transform-private-methods', {loose: true}],
  ],
};
