import type { Graphics } from 'pixi.js'
import { getGridSquircleRadius } from '@/rendering/grid/gridSquircle'

export const VS_CELL_BORDER_SIZE = 1.5

/** Covers the same inner face as a VS grid cell, without painting its border. */
export function drawVsCellOverlay(graphics: Graphics, x: number, y: number, width: number, height: number, color: number, alpha = 1) {
  const inset = VS_CELL_BORDER_SIZE
  const radius = Math.max(0, getGridSquircleRadius(width, height) - inset)
  graphics.roundRect(x + inset, y + inset, width - inset * 2, height - inset * 2, radius).fill({ color, alpha })
}
