import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@redshank/native';
import {useTranslation} from 'react-i18next';

import {accent, colors, primary} from '@constants/colors/colors';
import {AppLanguage, LANGUAGES, setAppLanguage} from '../../../i18n';

const LABELS: Record<AppLanguage, string> = {
  en: 'EN',
  es: 'ES',
};

type LanguageSwitchProps = {
  /** Fondo sobre el que se dibuja. El menú lateral es índigo. */
  onDark?: boolean;
};

/**
 * Selector de idioma de dos estados. Cambia el idioma en caliente y lo
 * persiste; no hace falta reiniciar la app.
 */
export const LanguageSwitch = ({onDark = false}: LanguageSwitchProps) => {
  const {i18n} = useTranslation();
  const current = i18n.language;

  const idleColor = onDark ? colors[accent][0] : colors[primary][0];
  const borderColor = onDark ? `${colors[accent][0]}66` : '#E4E4EC';

  return (
    <View
      style={[styles.container, {borderColor}]}
      accessibilityRole="radiogroup">
      {LANGUAGES.map(language => {
        const isActive = current === language;
        return (
          <TouchableOpacity
            key={language}
            accessibilityRole="radio"
            accessibilityState={{selected: isActive}}
            accessibilityLabel={LABELS[language]}
            activeOpacity={0.7}
            onPress={() => setAppLanguage(language)}
            style={[
              styles.option,
              isActive && {backgroundColor: colors[accent][0]},
            ]}>
            <Text
              size={13}
              color={isActive ? colors[accent][3] : idleColor}
              style={styles.label}>
              {LABELS[language]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 2,
    alignSelf: 'flex-start',
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
  },
});

export default LanguageSwitch;
