// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { APP_NAME } from './branding'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

it('loads and persists the current language preference', async () => {
  localStorage.setItem('game:language', 'fr')
  const { default: i18n } = await import('./i18n')
  expect(i18n.language).toBe('fr')
  expect(i18n.t('mainMenu.title')).toBe(APP_NAME)
  await i18n.changeLanguage('en')
  expect(localStorage.getItem('game:language')).toBe('en')
})

it('defaults to English for an invalid preference', async () => {
  localStorage.setItem('game:language', 'invalid')
  const { default: i18n } = await import('./i18n')
  expect(i18n.language).toBe('en')
})
