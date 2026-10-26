import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en.js'
import fr from '@/locales/fr.js'

export const LANGUAGE_STORAGE_KEY = 'corneromino:language'
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const
export type AppLanguage = typeof SUPPORTED_LANGUAGES[number]

const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const

function getInitialLanguage(): AppLanguage {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'en' || stored === 'fr') return stored
  return 'en'
}

const initialLanguage = getInitialLanguage()
document.documentElement.lang = initialLanguage

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', (language) => {
  const selected = SUPPORTED_LANGUAGES.includes(language as AppLanguage) ? language : 'en'
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, selected)
  document.documentElement.lang = selected
})

export default i18n
