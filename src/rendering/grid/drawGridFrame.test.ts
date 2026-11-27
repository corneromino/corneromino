import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { drawGridFrame, getFramedCellSize } from './drawGridFrame'

describe('grid frame', () => {
  it('straddles each board edge without covering the cell faces', () => {
    const frame = new Graphics()
    drawGridFrame(frame, 400, 300, 4, 12, 0x000000)

    for (const point of [{ x: -3, y: 150 }, { x: 3, y: 150 }, { x: 397, y: 150 }, { x: 403, y: 150 }, { x: 200, y: -3 }, { x: 200, y: 3 }, { x: 200, y: 297 }, { x: 200, y: 303 }]) {
      expect(frame.containsPoint(point)).toBe(true)
    }
    for (const point of [{ x: -5, y: 150 }, { x: 5, y: 150 }, { x: 395, y: 150 }, { x: 405, y: 150 }, { x: 200, y: 5 }, { x: 200, y: 295 }, { x: 7, y: 7 }, { x: 393, y: 7 }]) {
      expect(frame.containsPoint(point)).toBe(false)
    }
    frame.destroy()
  })

  it.each([[400, 300, 4, 3], [300, 400, 4, 3], [200, 200, 1, 1]])('reserves room for both outer frame edges in a %i by %i viewport', (width, height, columns, rows) => {
    const ratio = 0.04
    const cellSize = getFramedCellSize(width, height, columns, rows, ratio)
    expect((columns + ratio * 2) * cellSize).toBeLessThanOrEqual(width + 1e-9)
    expect((rows + ratio * 2) * cellSize).toBeLessThanOrEqual(height + 1e-9)
  })
})
