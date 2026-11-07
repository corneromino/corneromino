// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import en from '@/locales/en.js'
import { CareerChapterCarousel } from './CareerChapterCarousel'
import { CAREER_PATH_DASH_GAP_PX, CAREER_PATH_DASH_LENGTH_PX, CAREER_PATH_THICKNESS_PX, chapters } from './careerChapters'
import { GAME_CONFIGS } from '@/game/gameConfig'

const i18n = createInstance()
void i18n.init({ lng: 'en', initAsync: false, resources: { en: { translation: en } } })

let resize: ResizeObserverCallback
let width = 360

beforeEach(() => {
  width = 360
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resize = callback }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup() {
  render(<StrictMode><I18nextProvider i18n={i18n}><CareerChapterCarousel chapters={chapters} /></I18nextProvider></StrictMode>)
  return screen.getByRole('region', { name: 'Career' })
}

function scrollToChapter(viewport: HTMLElement, chapterIndex: number) {
  Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: chapterIndex * width, writable: true })
  fireEvent.scroll(viewport)
}

it('presents four ordered level cards in one accessible chapter at a time', () => {
  setup()
  expect(screen.queryByRole('heading')).toBeNull()
  const cards = screen.getAllByRole('listitem')
  expect(cards).toHaveLength(4)
  expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4'])
  expect(cards.map((card) => card.textContent)).toEqual(['1', '2', '3', '4'])
  const path = document.querySelector('path')
  expect(path?.getAttribute('stroke-width')).toBe(String(CAREER_PATH_THICKNESS_PX))
  expect(path?.getAttribute('stroke-dasharray')).toBe(`${CAREER_PATH_DASH_LENGTH_PX} ${CAREER_PATH_DASH_GAP_PX}`)
  expect(path?.getAttribute('d')).toContain(' C ')
  expect(path?.parentElement?.getAttribute('viewBox')).toBe(`0 0 ${chapters.length * 1_000} 1000`)
})

it('numbers levels continuously across chapters', () => {
  const viewport = setup()
  scrollToChapter(viewport, 1)
  expect(screen.getAllByRole('listitem').map((card) => card.textContent)).toEqual(['5', '6', '7', '8'])
})

it('opens the authored definition mapped to the pressed level-order slot', () => {
  const definition = { config: { ...GAME_CONFIGS.c003 }, gameMode: 'c003' as const, pieces: [], seed: 'first-level', version: 1 as const }
  const onPlayLevel = vi.fn()
  render(<I18nextProvider i18n={i18n}><CareerChapterCarousel chapters={[{ ...chapters[0]!, levelsData: [definition] }]} onPlayLevel={onPlayLevel} /></I18nextProvider>)

  fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))

  expect(onPlayLevel).toHaveBeenCalledWith(expect.objectContaining({ definition, levelIndex: 0, number: 1 }))
})

it('advances one chapter per swipe, supports reverse swipes, and stops at both ends', () => {
  const viewport = setup()
  scrollToChapter(viewport, 0)
  expect(screen.getByRole('article', { name: 'Chapter 1' })).toBeTruthy()
  scrollToChapter(viewport, 1)
  expect(screen.getByRole('article', { name: 'Chapter 2' })).toBeTruthy()
  scrollToChapter(viewport, 2)
  expect(screen.getByRole('article', { name: 'Chapter 3' })).toBeTruthy()
  for (let chapterIndex = 3; chapterIndex < chapters.length; chapterIndex += 1) scrollToChapter(viewport, chapterIndex)
  expect(screen.getByRole('article', { name: `Chapter ${chapters.length}` })).toBeTruthy()
  scrollToChapter(viewport, chapters.length - 2)
  expect(screen.getByRole('article', { name: `Chapter ${chapters.length - 1}` })).toBeTruthy()
})

it('keeps the current chapter selected until native scrolling passes the next snap midpoint', () => {
  const viewport = setup()
  Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: width * 0.49, writable: true })
  fireEvent.scroll(viewport)
  expect(screen.getByRole('article', { name: 'Chapter 1' })).toBeTruthy()
})

it('supports keyboard navigation and preserves the current chapter on resize', () => {
  const viewport = setup()
  fireEvent.keyDown(viewport, { key: 'ArrowRight' })
  expect(screen.getByRole('article', { name: 'Chapter 2' })).toBeTruthy()
  act(() => {
    width = 550
    resize([], {} as ResizeObserver)
  })
  expect(screen.getByRole('article', { name: 'Chapter 2' })).toBeTruthy()
  fireEvent.keyDown(viewport, { key: 'End' })
  expect(screen.getByRole('article', { name: `Chapter ${chapters.length}` })).toBeTruthy()
  fireEvent.keyDown(viewport, { key: 'ArrowLeft' })
  expect(screen.getByRole('article', { name: `Chapter ${chapters.length - 1}` })).toBeTruthy()
  fireEvent.keyDown(viewport, { key: 'Home' })
  expect(screen.getByRole('article', { name: 'Chapter 1' })).toBeTruthy()
})
