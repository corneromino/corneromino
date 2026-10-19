import { describe, expect, it, vi } from 'vitest'
import { attachGridInput, type GridInputCallbacks } from './gridInput'

function setup(callbacks: GridInputCallbacks, options = {}) {
  const target = new EventTarget()
  const captures = new Set<number>()
  const canvas = Object.assign(target, {
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id),
  }) as unknown as HTMLCanvasElement
  const detach = attachGridInput(canvas, {
    callbacks, threshold: 36, horizontalSteps: true,
    cellAt: (event) => ({ column: Math.floor(event.clientX / 56), row: Math.floor(event.clientY / 56) }),
    ...options,
  })
  function send(type: string, x = 10, y = 10, pointerId = 1) {
    const event = Object.assign(new Event(type), { clientX: x, clientY: y, pointerId, button: 0 })
    canvas.dispatchEvent(event)
  }
  return { send, detach, captures }
}

describe('shared grid input callbacks', () => {
  it('delivers a tap once with its cell coordinates and releases capture', () => {
    const onCellTap = vi.fn()
    const { send, captures } = setup({ onCellTap })
    send('pointerdown', 70, 120)
    send('pointerup', 70, 120)
    expect(onCellTap).toHaveBeenCalledOnce()
    expect(onCellTap.mock.calls[0][0]).toMatchObject({ column: 1, row: 2 })
    expect(captures.size).toBe(0)
  })

  it('emits incremental horizontal steps without also tapping or dropping', () => {
    const onSwipeRight = vi.fn(), onSwipeLeft = vi.fn(), onSwipeDown = vi.fn(), onCellTap = vi.fn()
    const { send } = setup({ onSwipeRight, onSwipeLeft, onSwipeDown, onCellTap })
    send('pointerdown')
    send('pointermove', 90, 10)
    send('pointermove', 90, 10)
    send('pointermove', 40, 10)
    send('pointerup', 40, 110)
    expect(onSwipeRight).toHaveBeenCalledOnce()
    expect(onSwipeRight.mock.calls[0][0].steps).toBe(2)
    expect(onSwipeLeft.mock.calls[0][0].steps).toBe(1)
    expect(onSwipeDown).not.toHaveBeenCalled()
    expect(onCellTap).not.toHaveBeenCalled()
  })

  it('dispatches a downward swipe once on release', () => {
    const onSwipeDown = vi.fn(), onCellTap = vi.fn()
    const { send } = setup({ onSwipeDown, onCellTap })
    send('pointerdown')
    send('pointermove', 10, 100)
    send('pointerup', 10, 100)
    expect(onSwipeDown).toHaveBeenCalledOnce()
    expect(onCellTap).not.toHaveBeenCalled()
  })

  it('suppresses taps after a pinch, cancellation, or a drag returning to its origin', () => {
    const onCellTap = vi.fn()
    const { send } = setup({ onCellTap })
    send('pointerdown')
    send('pointerdown', 50, 50, 2)
    send('pointerup', 50, 50, 2)
    send('pointerup')
    send('pointerdown')
    send('pointercancel')
    send('pointerup')
    send('pointerdown')
    send('pointermove', 10, 100)
    send('pointerup')
    expect(onCellTap).not.toHaveBeenCalled()
  })

  it('supports mode-owned tools and removes listeners on cleanup', () => {
    const onPointerDown = vi.fn(), onPointerMove = vi.fn(), onPointerCancel = vi.fn(), onCellTap = vi.fn()
    const { send, detach } = setup({ onPointerDown, onPointerMove, onPointerCancel, onCellTap }, { gestures: false })
    send('pointerdown')
    send('pointermove', 80)
    send('pointercancel')
    expect(onPointerDown).toHaveBeenCalledOnce()
    expect(onPointerMove).toHaveBeenCalledOnce()
    expect(onPointerCancel).toHaveBeenCalledOnce()
    expect(onCellTap).not.toHaveBeenCalled()
    detach()
    send('pointerdown')
    expect(onPointerDown).toHaveBeenCalledOnce()
  })
})
