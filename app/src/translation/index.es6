import i18n from 'i18next';
import LanguageDetector from 'i18next-electron-language-detector';
import translationEN from './translationEN.json';
import translationDE from './translationDE.json';
i18n
  .use(LanguageDetector)
  .init({
    // we init with resources
    resources: {
      en: {
        translations: translationEN
      },
      de: {
        translations: translationDE
      }
    },
    fallbackLng: "en",
    debug: true,

    // have a common namespace used around the full app
    ns: ["translations"],
    defaultNS: "translations",

    keySeparator: false, // we use content as keys

    interpolation: {
      escapeValue: false
    }
  });

export default i18n;