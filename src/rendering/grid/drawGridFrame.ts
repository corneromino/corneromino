import type { Graphics } from 'pixi.js'

/** Fit the cells and their outward-facing half-frame inside the viewport. */
export function getFramedCellSize(width: number, height: number, columns: number, rows: number, borderRatio: number) {
  return Math.min(width / (columns + borderRatio * 2), height / (rows + borderRatio * 2))
}

/** Center the frame on the board edge, leaving each cell face unobscured. */
export function drawGridFrame(graphics: Graphics, width: number, height: number, cellBorderSize: number, cellRadius: number, color: number) {
  const borderSize = Math.min(cellBorderSize * 2, width / 2, height / 2)
  graphics.roundRect(0, 0, width, height, cellRadius)
    .stroke({ color, width: borderSize })
}
