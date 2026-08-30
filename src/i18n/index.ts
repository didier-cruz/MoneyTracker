/**
 * Configuración de i18n de la app.
 *
 * Reemplaza al mecanismo anterior (`src/constants/languages`), que fijaba
 * el idioma en una constante del código y no se podía cambiar en runtime.
 *
 * El idioma se resuelve en este orden: lo que el usuario eligió antes
 * (persistido en AsyncStorage) → el idioma del dispositivo → inglés.
 */
import 'intl-pluralrules';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';

export const LANGUAGES = ['en', 'es'] as const;
export type AppLanguage = (typeof LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = '@moneytracker/language';

const FALLBACK_LANGUAGE: AppLanguage = 'en';

const isAppLanguage = (value: unknown): value is AppLanguage =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/**
 * Lee el idioma del sistema sin añadir una dependencia nativa: RN ya
 * expone el locale por `NativeModules`. Está envuelto en try/catch a
 * propósito — son APIs no documentadas que cambian entre versiones, y
 * un fallo aquí nunca debe impedir que la app arranque.
 */
const getDeviceLanguage = (): AppLanguage => {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ??
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;

    const prefix = String(locale ?? '')
      .slice(0, 2)
      .toLowerCase();

    return isAppLanguage(prefix) ? prefix : FALLBACK_LANGUAGE;
  } catch {
    return FALLBACK_LANGUAGE;
  }
};

/**
 * Inicializa i18n de forma SÍNCRONA con el idioma del dispositivo, para
 * que el primer render ya tenga textos. La preferencia guardada se lee
 * después (`hydrateStoredLanguage`), porque AsyncStorage es asíncrono y
 * bloquear el arranque por leerlo daría una pantalla en blanco.
 */
i18n.use(initReactI18next).init({
  resources: {
    en: {translation: en},
    es: {translation: es},
  },
  lng: getDeviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: {
    // React ya escapa por su cuenta; hacerlo aquí duplicaría el escapado.
    escapeValue: false,
  },
  returnNull: false,
});

/**
 * Aplica la preferencia guardada, si existe. Se llama una vez al
 * arrancar. Un fallo de lectura no es fatal: se queda con el idioma del
 * dispositivo.
 */
export const hydrateStoredLanguage = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isAppLanguage(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch (error) {
    console.warn('[i18n] no se pudo leer el idioma guardado:', error);
  }
};

/**
 * Cambia el idioma y lo persiste. El cambio en memoria se aplica primero
 * para que la UI responda de inmediato aunque falle el guardado.
 */
export const setAppLanguage = async (language: AppLanguage): Promise<void> => {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('[i18n] no se pudo guardar el idioma:', error);
  }
};

export const getAppLanguage = (): AppLanguage =>
  isAppLanguage(i18n.language) ? i18n.language : FALLBACK_LANGUAGE;

export default i18n;
