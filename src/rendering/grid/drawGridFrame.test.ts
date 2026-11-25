import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { drawGridFrame } from './drawGridFrame'

describe('grid frame', () => {
  it('has two cell borders of thickness on every edge and rounded outer corners', () => {
    const frame = new Graphics()
    drawGridFrame(frame, 400, 300, 4, 12, 0x000000)

    for (const point of [{ x: 7, y: 150 }, { x: 393, y: 150 }, { x: 200, y: 7 }, { x: 200, y: 293 }]) {
      expect(frame.containsPoint(point)).toBe(true)
    }
    for (const point of [{ x: 9, y: 150 }, { x: 391, y: 150 }, { x: 200, y: 9 }, { x: 200, y: 291 }, { x: 0, y: 0 }]) {
      expect(frame.containsPoint(point)).toBe(false)
    }
    frame.destroy()
  })
})
