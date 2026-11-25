// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('samples ten distinct markers per frame and moves only those whose intervals have elapsed', async () => {
  // All 112 positions contain a marker, initially at the fourth corner.
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.75)
  vi.spyOn(performance, 'now').mockReturnValue(0)
  let frame: FrameRequestCallback | undefined
  let frameId = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frame = callback; return ++frameId })
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  const { TetrominoBackground } = await import('./TetrominoBackground')
  const { container, unmount } = render(<TetrominoBackground />)
  const markers = [...container.querySelectorAll('span')]
  expect(markers).toHaveLength(112)
  const initialClasses = markers.map((marker) => marker.className)

  random.mockClear()
  frame!(1_000)
  expect(random).toHaveBeenCalledTimes(10)
  expect(markers.map((marker) => marker.className)).toEqual(initialClasses)

  random.mockClear()
  frame!(1_250)
  const changed = markers.filter((marker, index) => marker.className !== initialClasses[index])
  expect(changed).toHaveLength(10)
  expect(changed.every((marker) => marker.classList.contains('translate-x-0') && marker.classList.contains('translate-y-0'))).toBe(true)
  expect(random).toHaveBeenCalledTimes(20) // Ten samples and ten new intervals.

  frame!(1_250)
  expect(changed.every((marker) => marker.classList.contains('translate-x-0') && marker.classList.contains('translate-y-0'))).toBe(true)

  unmount()
  expect(cancel).toHaveBeenCalledWith(frameId)
})
