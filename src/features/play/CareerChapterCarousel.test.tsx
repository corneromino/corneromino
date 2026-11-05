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
const captures = new Set<number>()
const captureDescriptors = Object.fromEntries(
  ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)]),
)

beforeEach(() => {
  width = 360
  captures.clear()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resize = callback }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.isPrimary = init.isPrimary ?? true
    }
  })
  HTMLElement.prototype.setPointerCapture = (id) => { captures.add(id) }
  HTMLElement.prototype.hasPointerCapture = (id) => captures.has(id)
  HTMLElement.prototype.releasePointerCapture = (id) => { captures.delete(id) }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const [name, descriptor] of Object.entries(captureDescriptors)) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLElement.prototype, name)
  }
})

function setup() {
  render(<StrictMode><I18nextProvider i18n={i18n}><CareerChapterCarousel chapters={chapters} /></I18nextProvider></StrictMode>)
  return screen.getByRole('region', { name: 'Career' })
}

function swipe(viewport: HTMLElement, dx: number, dy = 0, cancel = false) {
  fireEvent.pointerDown(viewport, { clientX: 180, clientY: 200, button: 0, pointerId: 1, isPrimary: true })
  fireEvent.pointerMove(viewport, { clientX: 180 + dx, clientY: 200 + dy, pointerId: 1 })
  const end = cancel ? fireEvent.pointerCancel : fireEvent.pointerUp
  end(viewport, { clientX: 180 + dx, clientY: 200 + dy, pointerId: 1 })
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
  expect(screen.queryByRole('button')).toBeNull()
})

it('numbers levels continuously across chapters', () => {
  const viewport = setup()
  swipe(viewport, -150)
  expect(screen.getAllByRole('listitem').map((card) => card.textContent)).toEqual(['5', '6', '7', '8'])
})

it('advances one chapter per swipe, supports reverse swipes, and stops at both ends', () => {
  const viewport = setup()
  swipe(viewport, 200)
  expect(screen.getByRole('heading').textContent).toContain('The Beginning')
  swipe(viewport, -150)
  expect(screen.getByRole('heading').textContent).toContain('A New Perspective')
  swipe(viewport, -800)
  expect(screen.getByRole('heading').textContent).toContain('Finding Balance')
  swipe(viewport, -150)
  swipe(viewport, -150)
  expect(screen.getByRole('heading').textContent).toContain('A Different Turn')
  swipe(viewport, 150)
  expect(screen.getByRole('heading').textContent).toContain('Finding Balance')
  expect(captures.size).toBe(0)
})

it('keeps the current chapter on taps, short drags, vertical gestures, and cancellation', () => {
  const viewport = setup()
  swipe(viewport, 0)
  swipe(viewport, -12)
  swipe(viewport, -100, 180)
  swipe(viewport, -150, 0, true)
  expect(screen.getByRole('heading').textContent).toContain('The Beginning')
  expect(captures.size).toBe(0)
})

it('releases a stale mobile touch capture when its terminal event reaches the window', () => {
  const viewport = setup()
  fireEvent.pointerDown(viewport, { clientX: 180, clientY: 200, button: 0, pointerId: 7, isPrimary: true })
  fireEvent.pointerMove(viewport, { clientX: 60, clientY: 200, pointerId: 7 })
  expect(captures.has(7)).toBe(true)

  window.dispatchEvent(new PointerEvent('pointerup', { clientX: 60, clientY: 200, pointerId: 7 }))

  expect(captures.has(7)).toBe(false)
  expect(screen.getByRole('heading').textContent).toContain('The Beginning')
})

it('recovers a missing mobile terminal event before the next primary touch begins', () => {
  const viewport = setup()
  fireEvent.pointerDown(viewport, { clientX: 180, clientY: 200, button: 0, pointerId: 7, isPrimary: true })
  expect(captures.has(7)).toBe(true)

  window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, isPrimary: true }))

  expect(captures.has(7)).toBe(false)
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
  expect(screen.getByRole('heading').textContent).toContain('A Different Turn')
  fireEvent.keyDown(viewport, { key: 'ArrowLeft' })
  expect(screen.getByRole('heading').textContent).toContain('Finding Balance')
  fireEvent.keyDown(viewport, { key: 'Home' })
  expect(screen.getByRole('heading').textContent).toContain('The Beginning')
})
