// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  window.localStorage.clear()
})

describe('Nokomino language preference', () => {
  it('copies the legacy preference automatically and uses the renamed brand in French', async () => {
    window.localStorage.setItem('corneromino:language', 'fr')
    const { default: i18n, LANGUAGE_STORAGE_KEY } = await import('./i18n')
    expect(LANGUAGE_STORAGE_KEY).toBe('nokomino:language')
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr')
    expect(i18n.language).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
    expect(i18n.t('mainMenu.title')).toBe('Nokomino')
  })

  it('prefers a newer choice and persists subsequent changes under the new key', async () => {
    window.localStorage.setItem('corneromino:language', 'fr')
    window.localStorage.setItem('nokomino:language', 'en')
    const { default: i18n } = await import('./i18n')
    expect(i18n.language).toBe('en')
    await i18n.changeLanguage('fr')
    expect(window.localStorage.getItem('nokomino:language')).toBe('fr')
  })

  it('ignores invalid legacy preferences', async () => {
    window.localStorage.setItem('corneromino:language', 'invalid')
    const { default: i18n } = await import('./i18n')
    expect(i18n.language).toBe('en')
    expect(i18n.t('mainMenu.title')).toBe('Nokomino')
  })
})
