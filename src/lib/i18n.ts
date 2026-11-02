import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en.js'
import fr from '@/locales/fr.js'

export const LANGUAGE_STORAGE_KEY = 'nokomino:language'
const LEGACY_LANGUAGE_STORAGE_KEY = 'corneromino:language'
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const
export type AppLanguage = typeof SUPPORTED_LANGUAGES[number]

const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const

function getInitialLanguage(): AppLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === 'en' || stored === 'fr') return stored
    const legacy = window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY)
    if (legacy === 'en' || legacy === 'fr') {
      try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, legacy) } catch { /* Keep the language usable when storage is full. */ }
      return legacy
    }
  } catch { /* Storage can be unavailable in private or restricted contexts. */ }
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
  try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, selected) } catch { /* The in-session preference still applies. */ }
  document.documentElement.lang = selected
})

export default i18n
