import type { Graphics } from 'pixi.js'

/** Draw an inset frame as wide as the two adjacent cell borders. */
export function drawGridFrame(graphics: Graphics, width: number, height: number, cellBorderSize: number, cellRadius: number, color: number) {
  const borderSize = Math.min(cellBorderSize * 2, width / 2, height / 2)
  const inset = borderSize / 2
  graphics.roundRect(inset, inset, width - borderSize, height - borderSize, Math.max(0, cellRadius - inset))
    .stroke({ color, width: borderSize })
}
