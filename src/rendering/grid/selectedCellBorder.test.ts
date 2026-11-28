import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { SELECTED_CELL_BORDER_OPACITY } from '@/rendering/colors'
import { drawCellBorder, getCellSelectionProgress, getSelectionBorderAlpha, getSelectionBorderSize, mixSelectionColor } from './selectedCellBorder'

describe('selected cell border', () => {
  it('uses the configured overlay when selected and leaves only the normal border when deselected', () => {
    expect(getSelectionBorderAlpha(1)).toBe(SELECTED_CELL_BORDER_OPACITY)
    expect(getSelectionBorderAlpha(0)).toBe(0)
  })

  it.each([0, 0.1, 1])('fades the selected overlay from opacity %s as the cell grows back', (opacity) => {
    for (const [scale, fraction] of [[0.85, 1], [0.88, 0.8], [0.925, 0.5], [0.97, 0.2], [1, 0]] as const) {
      const progress = getCellSelectionProgress(scale, false, 0.85)
      expect(getSelectionBorderAlpha(progress, opacity)).toBeCloseTo(fraction * opacity)
    }
  })

  it('follows the scale on selection and return, including an unchanged scale', () => {
    expect(getCellSelectionProgress(1, true, 0.8)).toBe(0)
    expect(getCellSelectionProgress(0.9, true, 0.8)).toBeCloseTo(0.5)
    expect(getCellSelectionProgress(0.8, false, 0.8)).toBe(1)
    expect(getCellSelectionProgress(1, true, 1)).toBe(1)
    expect(getCellSelectionProgress(1, false, 1)).toBe(0)
  })

  it('blends face and marker colors continuously in both directions', () => {
    expect(mixSelectionColor(0xff0000, 0x0000ff, 0)).toBe(0xff0000)
    expect(mixSelectionColor(0xff0000, 0x0000ff, 0.5)).toBe(0x800080)
    expect(mixSelectionColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff)
    expect(mixSelectionColor(0xff0000, 0x0000ff, -1)).toBe(0xff0000)
    expect(mixSelectionColor(0xff0000, 0x0000ff, 2)).toBe(0x0000ff)
  })

  it('interpolates the configured border thickness and limits it to the cell', () => {
    expect(getSelectionBorderSize(4, 0, 100, 2)).toBe(4)
    expect(getSelectionBorderSize(4, 0.5, 100, 2)).toBe(6)
    expect(getSelectionBorderSize(4, 1, 100, 2)).toBe(8)
    expect(getSelectionBorderSize(4, 1, 100, 0)).toBe(0)
    expect(getSelectionBorderSize(4, 1, 10, 4)).toBeCloseTo(4.999)
    expect(getSelectionBorderSize(4, 1, 100, -1)).toBe(0)
  })

  it('draws only the inset border, not the cell face', () => {
    const graphics = new Graphics()
    drawCellBorder(graphics, 0, 0, 100, 100, 4, 6, 0xffffff)
    expect(graphics.containsPoint({ x: 2, y: 50 })).toBe(true)
    expect(graphics.containsPoint({ x: 50, y: 50 })).toBe(false)
    graphics.destroy()
  })
})
