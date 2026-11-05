// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import en from '@/locales/en.js'
import { CareerChapterCarousel } from './CareerChapterCarousel'
import { CAREER_PATH_DASH_GAP_PX, CAREER_PATH_DASH_LENGTH_PX, CAREER_PATH_THICKNESS_PX, chapters } from './careerChapters'

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
  expect(screen.getByRole('heading', { name: 'Chapter 1 The Beginning' })).toBeTruthy()
  const cards = screen.getAllByRole('listitem')
  expect(cards).toHaveLength(4)
  expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4'])
  expect(cards.map((card) => card.textContent)).toEqual(['1', '2', '3', '4'])
  const path = document.querySelector('path')
  expect(path?.getAttribute('stroke-width')).toBe(String(CAREER_PATH_THICKNESS_PX))
  expect(path?.getAttribute('stroke-dasharray')).toBe(`${CAREER_PATH_DASH_LENGTH_PX} ${CAREER_PATH_DASH_GAP_PX}`)
  expect(path?.getAttribute('d')).toContain(' C ')
  expect(path?.parentElement?.getAttribute('viewBox')).toBe(`0 0 ${chapters.length * 1_000} 1000`)
  expect(screen.queryByRole('button')).toBeNull()
})

it('numbers levels continuously across chapters', () => {
  const viewport = setup()
  scrollToChapter(viewport, 1)
  expect(screen.getAllByRole('listitem').map((card) => card.textContent)).toEqual(['5', '6', '7', '8'])
})

it('advances one chapter per swipe, supports reverse swipes, and stops at both ends', () => {
  const viewport = setup()
  scrollToChapter(viewport, 0)
  expect(screen.getByRole('heading').textContent).toContain('The Beginning')
  scrollToChapter(viewport, 1)
  expect(screen.getByRole('heading').textContent).toContain('A New Perspective')
  scrollToChapter(viewport, 2)
  expect(screen.getByRole('heading').textContent).toContain('Finding Balance')
  for (let chapterIndex = 3; chapterIndex < chapters.length; chapterIndex += 1) scrollToChapter(viewport, chapterIndex)
  expect(screen.getByRole('heading').textContent).toContain(`Chapter ${chapters.length} ${chapters.at(-1)?.title}`)
  scrollToChapter(viewport, chapters.length - 2)
  expect(screen.getByRole('heading').textContent).toContain(`Chapter ${chapters.length - 1} ${chapters.at(-2)?.title}`)
})

it('keeps the current chapter selected until native scrolling passes the next snap midpoint', () => {
  const viewport = setup()
  Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: width * 0.49, writable: true })
  fireEvent.scroll(viewport)
  expect(screen.getByRole('heading').textContent).toContain('The Beginning')
})

it('supports keyboard navigation and preserves the current chapter on resize', () => {
  const viewport = setup()
  fireEvent.keyDown(viewport, { key: 'ArrowRight' })
  expect(screen.getByRole('heading').textContent).toContain('A New Perspective')
  act(() => {
    width = 550
    resize([], {} as ResizeObserver)
  })
  expect(screen.getByRole('heading').textContent).toContain('A New Perspective')
  fireEvent.keyDown(viewport, { key: 'End' })
  expect(screen.getByRole('heading').textContent).toContain(`Chapter ${chapters.length} ${chapters.at(-1)?.title}`)
  fireEvent.keyDown(viewport, { key: 'ArrowLeft' })
  expect(screen.getByRole('heading').textContent).toContain(`Chapter ${chapters.length - 1} ${chapters.at(-2)?.title}`)
  fireEvent.keyDown(viewport, { key: 'Home' })
  expect(screen.getByRole('heading').textContent).toContain('The Beginning')
})
