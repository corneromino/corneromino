import { describe, expect, it } from 'vitest'
import { getGridMetrics } from './gridGeometry'
import { getLockRippleCenter } from './lockRipple'

describe('lock ripple position', () => {
  const cells = [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }]

  it('uses the canvas origin and the board transform after zooming and panning', () => {
    const metrics = getGridMetrics({ infinite: false, columns: 8, rows: 8 }, {
      width: 320, height: 320, cellSize: 40, fit: 'manual', zoom: 2, offsetX: -70, offsetY: -110,
    })
    expect(getLockRippleCenter(metrics, { x: 60, y: 170 }, cells)).toEqual({ x: 150, y: 300 })
  })

  it('follows a shifted canvas origin at fitted zoom', () => {
    const metrics = getGridMetrics({ infinite: false, columns: 8, rows: 8 }, {
      width: 320, height: 320, cellSize: 40, fit: 'manual', zoom: 1, offsetX: 0, offsetY: 0,
    })
    expect(getLockRippleCenter(metrics, { x: 13, y: 27 }, cells)).toEqual({ x: 93, y: 147 })
  })
})
