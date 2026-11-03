// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_NAME } from './branding'
import { HISTORICAL_STORAGE, ORIGINAL_STORAGE } from './__fixtures__/legacyStorage'

beforeEach(() => {
  vi.resetModules()
  window.localStorage.clear()
})

describe('Game language preference', () => {
  it.each(HISTORICAL_STORAGE)('copies the language from $label and uses the configured brand in French', async (source) => {
    window.localStorage.setItem(source.languageKey, 'fr')
    const { default: i18n, LANGUAGE_STORAGE_KEY } = await import('./i18n')
    expect(LANGUAGE_STORAGE_KEY).toBe('game:language')
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr')
    expect(i18n.language).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
    expect(i18n.t('mainMenu.title')).toBe(APP_NAME)
  })

  it('prefers a newer choice and persists subsequent changes under the new key', async () => {
    window.localStorage.setItem(ORIGINAL_STORAGE.languageKey, 'fr')
    window.localStorage.setItem('game:language', 'en')
    const { default: i18n } = await import('./i18n')
    expect(i18n.language).toBe('en')
    await i18n.changeLanguage('fr')
    expect(window.localStorage.getItem('game:language')).toBe('fr')
  })

  it('ignores invalid legacy preferences', async () => {
    window.localStorage.setItem(ORIGINAL_STORAGE.languageKey, 'invalid')
    const { default: i18n } = await import('./i18n')
    expect(i18n.language).toBe('en')
    expect(i18n.t('mainMenu.title')).toBe(APP_NAME)
  })
})
