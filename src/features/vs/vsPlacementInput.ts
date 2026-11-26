import type { GridInputCallbacks } from '@/rendering/grid/gridInput'
import { canPlayVsTurn, selectVsCell, type VsCorner, type VsLocalGameState } from './vsLocalGame'

const AIM_THRESHOLD_PX = 8

/** Owns VS pointer gestures; the chosen cell stays fixed while aiming. */
export function createVsPlacementInput(
  canvas: HTMLCanvasElement,
  getGame: () => VsLocalGameState,
  cellAt: (event: PointerEvent) => { column: number; row: number },
  onCellTap: (column: number, row: number) => void,
  onAim: (column: number, row: number, corner: VsCorner) => void,
) {
  const pointers = new Set<number>()
  let blocked = false
  let press: {
    pointerId: number
    x: number
    y: number
    column: number
    row: number
    canAim: boolean
    created: boolean
    moved: boolean
    lastCorner?: VsCorner
  } | null = null

  function updateAim(event: PointerEvent) {
    if (!press || press.pointerId !== event.pointerId || blocked) return
    const dx = event.clientX - press.x
    const dy = event.clientY - press.y
    if (Math.hypot(dx, dy) < AIM_THRESHOLD_PX) return
    press.moved = true
    if (!press.canAim) return
    const corner: VsCorner = dy < 0 ? (dx < 0 ? 0 : 1) : (dx < 0 ? 3 : 2)
    if (corner === press.lastCorner) return
    press.lastCorner = corner
    onAim(press.column, press.row, corner)
  }

  function release(event: PointerEvent, cancelled: boolean) {
    if (!pointers.delete(event.pointerId)) return
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (press?.pointerId === event.pointerId) {
      if (!cancelled) updateAim(event)
      if (!cancelled && !blocked && !press.moved && !press.created) onCellTap(press.column, press.row)
      press = null
    }
    if (pointers.size === 0) blocked = false
  }

  const callbacks: GridInputCallbacks = {
    onPointerDown(event) {
      pointers.add(event.pointerId)
      canvas.setPointerCapture(event.pointerId)
      if (pointers.size !== 1) {
        blocked = true
        return
      }
      const { column, row } = cellAt(event)
      const game = getGame()
      const pending = game.pendingPlacement
      const existing = canPlayVsTurn(game) && pending?.column === column && pending.row === row
      const selected = !pending ? selectVsCell(game, column, row) : game
      const created = !pending && selected.pendingPlacement?.column === column && selected.pendingPlacement.row === row
      press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, column, row, canAim: !!existing || !!created, created: !!created, moved: false }
      if (created) onCellTap(column, row)
    },
    onPointerMove: updateAim,
    onPointerUp: (event) => release(event, false),
    onPointerCancel: (event) => release(event, true),
  }

  return { callbacks }
}
