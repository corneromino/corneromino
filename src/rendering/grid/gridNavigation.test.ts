import { describe, expect, it, vi } from 'vitest'
import { attachGridInput } from './gridInput'
import { constrainGridView, createGridNavigation, type GridView } from './gridNavigation'

function setup(options: { finite?: boolean; tool?: Parameters<typeof createGridNavigation>[1]['tool']; scale?: number } = {}) {
  const captures = new Set<number>()
  const canvas = Object.assign(new EventTarget(), {
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 300 / (options.scale ?? 1), height: 300 / (options.scale ?? 1) }),
  }) as unknown as HTMLCanvasElement
  let view: GridView = { zoom: 1, offsetX: 0, offsetY: 0 }
  const onTap = vi.fn(), onNavigate = vi.fn()
  const size = { width: 300, height: 300 }
  const navigation = createGridNavigation(canvas, {
    minZoom: options.finite ? 1 : 0.1, maxZoom: 4, getView: () => view, getSize: () => size,
    setView: (next) => { view = options.finite ? constrainGridView(next, size, size) : next },
    onTap, onNavigate, tool: options.tool,
  })
  const detach = attachGridInput(canvas, { gestures: false, cellAt: () => ({ column: 0, row: 0 }), callbacks: navigation.callbacks })
  function send(type: string, x = 100, y = 100, pointerId = 1) {
    canvas.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX: x + 10, clientY: y + 20, button: 0 }))
  }
  function wheel(deltaY: number, x = 150, y = 150) {
    const event = Object.assign(new Event('wheel', { cancelable: true }), { deltaY, clientX: x + 10, clientY: y + 20 })
    canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  }
  return { send, wheel, navigation, detach, captures, onTap, onNavigate, view: () => view }
}

describe('shared grid navigation', () => {
  it('allows taps and small jitter without panning', () => {
    const test = setup()
    test.send('pointerdown')
    test.send('pointermove', 103, 102)
    test.send('pointerup', 103, 102)
    expect(test.onTap).toHaveBeenCalledOnce()
    expect(test.onNavigate).not.toHaveBeenCalled()
    expect(test.view()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
    expect(test.captures.size).toBe(0)
  })

  it('pans after the threshold and never taps even when dragged back to the start', () => {
    const test = setup()
    test.send('pointerdown')
    test.send('pointermove', 130, 140)
    expect(test.view()).toMatchObject({ offsetX: 30, offsetY: 40 })
    test.send('pointermove', 100, 100)
    test.send('pointerup')
    expect(test.onTap).not.toHaveBeenCalled()
    expect(test.onNavigate).toHaveBeenCalledOnce()
  })

  it('anchors wheel zoom at the cursor and clamps zoom-out to the fitted view', () => {
    const test = setup({ finite: true })
    test.wheel(-100, 100, 200)
    expect(test.view().zoom).toBeCloseTo(1.1)
    expect((100 - test.view().offsetX) / test.view().zoom).toBeCloseTo(100)
    expect((200 - test.view().offsetY) / test.view().zoom).toBeCloseTo(200)
    test.wheel(100)
    expect(test.view()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
    test.wheel(100)
    expect(test.view().zoom).toBe(1)
    expect(test.onNavigate).toHaveBeenCalledTimes(3)
    for (let i = 0; i < 50; i++) test.wheel(-100)
    expect(test.view().zoom).toBe(4)
  })

  it('pinches around the moving midpoint and lets the remaining finger pan without a tap', () => {
    const test = setup()
    test.send('pointerdown', 100, 150, 1)
    test.send('pointerdown', 200, 150, 2)
    test.send('pointermove', 50, 150, 1)
    test.send('pointermove', 250, 150, 2)
    expect(test.view()).toEqual({ zoom: 2, offsetX: -150, offsetY: -150 })
    test.send('pointermove', 70, 180, 1)
    test.send('pointermove', 270, 180, 2)
    expect(test.view()).toEqual({ zoom: 2, offsetX: -130, offsetY: -120 })
    test.send('pointerup', 270, 180, 2)
    test.send('pointermove', 90, 200, 1)
    expect(test.view()).toEqual({ zoom: 2, offsetX: -110, offsetY: -100 })
    test.send('pointerup', 90, 200, 1)
    expect(test.onTap).not.toHaveBeenCalled()
    expect(test.captures.size).toBe(0)
    test.send('pointerdown')
    test.send('pointerup')
    expect(test.onTap).toHaveBeenCalledOnce()
  })

  it('rebases a pinch when fingers are added or replaced', () => {
    const test = setup()
    test.send('pointerdown', 100, 150, 1)
    test.send('pointerdown', 200, 150, 2)
    test.send('pointermove', 250, 150, 2)
    const before = test.view()
    test.send('pointerdown', 200, 200, 3)
    test.send('pointerup', 100, 150, 1)
    test.send('pointermove', 200, 200, 3)
    expect(test.view()).toEqual(before)
    test.send('pointerup', 250, 150, 2)
    test.send('pointerup', 200, 200, 3)
    expect(test.onTap).not.toHaveBeenCalled()
  })

  it('honors finite board bounds on both axes', () => {
    const test = setup({ finite: true })
    test.send('pointerdown')
    test.send('pointermove', 500, 500)
    test.send('pointerup', 500, 500)
    expect(test.view()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
    test.wheel(-100)
    test.send('pointerdown')
    test.send('pointermove', -500, -500)
    test.send('pointerup', -500, -500)
    expect(test.view()).toEqual({ zoom: 1.1, offsetX: -30, offsetY: -30 })
    expect(test.onTap).not.toHaveBeenCalled()
  })

  it('normalizes pointer coordinates when the canvas CSS size differs from rendering size', () => {
    const test = setup({ scale: 2 })
    test.wheel(-100, 50, 50)
    expect(test.view().offsetX).toBeCloseTo(-10)
    test.send('pointerdown', 30, 30)
    test.send('pointermove', 50, 40)
    expect(test.view().offsetX).toBeCloseTo(30)
    expect(test.view().offsetY).toBeCloseTo(10)
  })

  it('never taps after cancellation, lost capture, wheel during press, or reset', () => {
    const test = setup()
    for (const type of ['pointercancel', 'lostpointercapture']) {
      test.send('pointerdown')
      test.send(type)
      test.send('pointerup')
    }
    test.send('pointerdown')
    test.wheel(-100)
    test.send('pointerup')
    test.send('pointerdown')
    test.navigation.reset()
    test.send('pointerup')
    expect(test.onTap).not.toHaveBeenCalled()
    expect(test.captures.size).toBe(0)
    test.detach()
    test.send('pointerdown')
    expect(test.captures.size).toBe(0)
  })

  it('keeps editor handles/moving selections separate from panning and tapping', () => {
    const tool = { start: vi.fn(() => true), move: vi.fn(), end: vi.fn() }
    const test = setup({ tool })
    test.send('pointerdown')
    test.send('pointermove', 150, 150)
    test.send('pointerup', 150, 150)
    expect(tool.move).toHaveBeenCalledOnce()
    expect(tool.end).toHaveBeenCalledOnce()
    expect(test.view()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
    expect(test.onTap).not.toHaveBeenCalled()
    test.send('pointerdown', 100, 150, 1)
    test.send('pointerdown', 200, 150, 2)
    expect(tool.end).toHaveBeenCalledTimes(2)
    test.send('pointermove', 250, 150, 2)
    expect(test.view().zoom).toBe(1.5)
    test.send('pointerup', 250, 150, 2)
    test.send('pointerup', 100, 150, 1)
    expect(test.onTap).not.toHaveBeenCalled()
  })

  it('centers smaller boards and clamps larger boards on each axis independently', () => {
    expect(constrainGridView({ zoom: 2, offsetX: -999, offsetY: 999 }, { width: 400, height: 200 }, { width: 100, height: 150 }))
      .toEqual({ zoom: 2, offsetX: 100, offsetY: 0 })
  })
})
