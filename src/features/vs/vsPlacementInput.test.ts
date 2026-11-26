import { describe, expect, it, vi } from 'vitest'
import { attachGridInput } from '@/rendering/grid/gridInput'
import { createVsLocalGame, finishVsTurn, selectVsCell, setVsPendingCorner, type VsLocalGameState } from './vsLocalGame'
import { createVsPlacementInput } from './vsPlacementInput'

function setup(initial: VsLocalGameState = createVsLocalGame(() => 0)) {
  const captures = new Set<number>()
  const canvas = Object.assign(new EventTarget(), {
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id),
  }) as unknown as HTMLCanvasElement
  let game = initial
  const onTap = vi.fn((column: number, row: number) => { game = selectVsCell(game, column, row) })
  const onAim = vi.fn((column, row, corner) => { game = setVsPendingCorner(game, column, row, corner) })
  const cellAt = (event: PointerEvent) => ({ column: Math.floor(event.clientX / 50), row: Math.floor(event.clientY / 50) })
  const input = createVsPlacementInput(canvas, () => game, cellAt, onTap, onAim)
  const detach = attachGridInput(canvas, { callbacks: input.callbacks, gestures: false, cellAt })
  function send(type: string, x = 125, y = 125, pointerId = 1) {
    canvas.dispatchEvent(Object.assign(new Event(type), { clientX: x, clientY: y, pointerId, button: 0 }))
  }
  return { send, detach, captures, onAim, onTap, game: () => game }
}

describe('VS corner aiming', () => {
  it('places on press and changes corners live in all four directions without moving the cell', () => {
    const test = setup()
    test.send('pointerdown')
    expect(test.game().pendingPlacement).toEqual({ column: 2, row: 2, corner: 1 })
    for (const [x, y, corner] of [[110, 110, 0], [140, 110, 1], [180, 180, 2], [110, 140, 3]] as const) {
      test.send('pointermove', x, y)
      expect(test.game().pendingPlacement).toEqual({ column: 2, row: 2, corner })
    }
    test.send('pointerup', 110, 140)
    expect(test.game().pendingPlacement?.corner).toBe(3)
    expect(test.game().placedCells).toHaveLength(0)
    expect(test.onTap).toHaveBeenCalledOnce()
    expect(test.captures.size).toBe(0)
    test.detach()
  })

  it('retains ordinary tap-to-place and tap-to-cycle, including small jitter', () => {
    const test = setup()
    test.send('pointerdown'); test.send('pointerup')
    expect(test.game().pendingPlacement?.corner).toBe(1)
    test.send('pointerdown'); test.send('pointermove', 127, 127); test.send('pointerup', 127, 127)
    expect(test.game().pendingPlacement?.corner).toBe(2)
    expect(test.onAim).not.toHaveBeenCalled()
    test.detach()
  })

  it('adjusts a pending cell without cycling and preserves direction when returning to the dead zone', () => {
    const test = setup(selectVsCell(createVsLocalGame(() => 0), 2, 2))
    test.send('pointerdown')
    test.send('pointermove', 110, 110)
    test.send('pointermove', 126, 126)
    test.send('pointerup', 126, 126)
    expect(test.game().pendingPlacement).toEqual({ column: 2, row: 2, corner: 0 })
    expect(test.onTap).not.toHaveBeenCalled()
    test.detach()
  })

  it('keeps the aimed corner in the confirmed move and preserves other draft state', () => {
    const initial = { ...createVsLocalGame(() => 0), selectedCellKeys: ['0,0'], pendingMoveDirection: 'diagonal' as const }
    const test = setup(initial)
    test.send('pointerdown')
    test.send('pointermove', 110, 140)
    test.send('pointerup', 110, 140)
    expect(test.game().selectedCellKeys).toEqual(['0,0'])
    expect(test.game().pendingMoveDirection).toBe('diagonal')
    const confirmed = finishVsTurn(test.game())
    expect(confirmed.placedCells).toContainEqual({ column: 2, row: 2, corner: 3, player: 0 })
    expect(confirmed.nextMoveConstraint).toEqual({ direction: 'diagonal', originColumn: 2, originRow: 2 })
    test.detach()
  })

  it('preserves taps on placed cells and on other cells while a placement is pending', () => {
    const initial = { ...selectVsCell(createVsLocalGame(() => 0), 2, 2), placedCells: [{ column: 3, row: 2, corner: 0 as const, player: 0 as const }] }
    const test = setup(initial)
    test.send('pointerdown', 175, 125); test.send('pointerup', 175, 125)
    expect(test.game().selectedCellKeys).toEqual(['3,2'])
    test.send('pointerdown', 225, 125); test.send('pointerup', 225, 125)
    expect(test.game().pendingMoveDirection).toBe('diagonal')
    expect(test.onAim).not.toHaveBeenCalled()
    test.detach()
  })

  it('does not place or aim on an illegal cell, or when viewing a past position', () => {
    const played = finishVsTurn(selectVsCell(createVsLocalGame(() => 0), 4, 4))
    const test = setup(played)
    test.send('pointerdown', 25, 25); test.send('pointermove', 10, 10); test.send('pointerup', 10, 10)
    expect(test.game().pendingPlacement).toBeNull()
    expect(test.onAim).not.toHaveBeenCalled()
    test.detach()
    const past = setup({ ...played, history: { ...played.history, index: 0 }, allowHistoryRewrite: false })
    past.send('pointerdown'); past.send('pointermove', 110, 110); past.send('pointerup', 110, 110)
    expect(past.game().pendingPlacement).toBeNull()
    expect(past.onAim).not.toHaveBeenCalled()
    past.detach()
  })

  it('does not produce a tap or further aiming after a second pointer or cancellation', () => {
    const test = setup(selectVsCell(createVsLocalGame(() => 0), 2, 2))
    test.send('pointerdown'); test.send('pointerdown', 180, 180, 2)
    test.send('pointermove', 110, 110); test.send('pointerup', 180, 180, 2); test.send('pointerup', 110, 110)
    test.send('pointerdown'); test.send('pointercancel')
    expect(test.game().pendingPlacement?.corner).toBe(1)
    expect(test.onAim).not.toHaveBeenCalled()
    expect(test.onTap).not.toHaveBeenCalled()
    expect(test.captures.size).toBe(0)
    test.detach()
  })
})
