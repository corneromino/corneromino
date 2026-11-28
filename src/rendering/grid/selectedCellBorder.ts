import type { Graphics } from 'pixi.js'
import { SELECTED_CELL_SCALE } from '@/game/gameConfig'
import { SELECTED_CELL_BORDER_OPACITY, SELECTED_CELL_BORDER_THICKNESS_MULTIPLIER } from '@/rendering/colors'

/** Selection progress follows the cell's scale, including interrupted transitions. */
export function getCellSelectionProgress(scale: number, selected: boolean, selectedScale = SELECTED_CELL_SCALE) {
  if (selectedScale === 1) return selected ? 1 : 0
  return Math.max(0, Math.min(1, (1 - scale) / (1 - selectedScale)))
}

/** Fade the selected color over the normal border, independently of the face underneath. */
export function getSelectionBorderAlpha(progress: number, targetOpacity: number = SELECTED_CELL_BORDER_OPACITY) {
  return Math.max(0, Math.min(1, progress)) * Math.max(0, Math.min(1, targetOpacity))
}

/** Interpolate the inset border thickness without allowing it to exceed the cell face. */
export function getSelectionBorderSize(normal: number, progress: number, maxSize: number, multiplier: number = SELECTED_CELL_BORDER_THICKNESS_MULTIPLIER) {
  const amount = Math.max(0, Math.min(1, progress))
  const target = Math.max(0, multiplier)
  return Math.min(Math.max(0, maxSize / 2 - 0.001), Math.max(0, normal) * (1 + (target - 1) * amount))
}

/** Blend an unselected color toward its selected counterpart. */
export function mixSelectionColor(normal: number, selected: number, progress: number) {
  const amount = Math.max(0, Math.min(1, progress))
  const channel = (shift: number) => Math.round(((normal >> shift) & 0xff) * (1 - amount) + ((selected >> shift) & 0xff) * amount)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/** Draw an inset ring with the same geometry as a cell body's border. */
export function drawCellBorder(graphics: Graphics, x: number, y: number, width: number, height: number, border: number, radius: number, color: number, alpha = 1) {
  if (border <= 0) return
  graphics.roundRect(x, y, width, height, radius).fill({ color, alpha })
  graphics.roundRect(x + border, y + border, width - border * 2, height - border * 2, Math.max(0, radius - border)).cut()
}
