import type { Graphics } from 'pixi.js'

export interface CellBodyStyle {
  fillColor: number
  borderColor: number
  borderSize: number
  borderRadius: number
  innerRadius?: number
  outline?: { color: number; width: number; inset: number }
}

export interface CornerMarkerStyle {
  color: number
  alpha?: number
  size: number
  paddingX: number
  paddingY: number
  radius: number
}

export function drawCellBody(graphics: Graphics, x: number, y: number, width: number, height: number, style: CellBodyStyle) {
  const inset = style.borderSize
  graphics.roundRect(x, y, width, height, style.borderRadius).fill(style.borderColor)
  graphics.roundRect(x + inset, y + inset, width - inset * 2, height - inset * 2, style.innerRadius ?? Math.max(0, style.borderRadius - inset)).fill(style.fillColor)
  if (style.outline) {
    const { inset: outlineInset, color, width: strokeWidth } = style.outline
    graphics.rect(x + outlineInset, y + outlineInset, width - outlineInset * 2, height - outlineInset * 2).stroke({ color, width: strokeWidth })
  }
}

/** Clockwise: top-left, top-right, bottom-right, bottom-left. */
export function getCornerMarkerPosition(corner: number, width: number, height: number, style: Pick<CornerMarkerStyle, 'size' | 'paddingX' | 'paddingY'>) {
  return {
    x: corner === 1 || corner === 2 ? width - style.paddingX - style.size : style.paddingX,
    y: corner === 2 || corner === 3 ? height - style.paddingY - style.size : style.paddingY,
  }
}

/** Explicit positions also support interpolating a marker between corners. */
export function drawCornerMarker(graphics: Graphics, x: number, y: number, style: CornerMarkerStyle) {
  graphics.roundRect(x, y, style.size, style.size, style.radius).fill({ color: style.color, alpha: style.alpha ?? 1 })
}

export function drawCorneromino(graphics: Graphics, corner: number, width: number, height: number, body: CellBodyStyle, marker: CornerMarkerStyle) {
  drawCellBody(graphics, 0, 0, width, height, body)
  const position = getCornerMarkerPosition(corner, width, height, marker)
  drawCornerMarker(graphics, position.x, position.y, marker)
}
