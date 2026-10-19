import { describe, expect, it } from 'vitest'
import { getGridMetrics, gridCellToScreen, isInsideGrid, screenToGridCell } from './gridGeometry'

describe('shared grid geometry', () => {
  it('fits a finite board with square cells and centers the unused space', () => {
    expect(getGridMetrics({ infinite: false, columns: 4, rows: 2 }, { width: 400, height: 300, cellSize: 56, fit: 'contain' }))
      .toEqual({ cellWidth: 100, cellHeight: 100, width: 400, height: 200, offsetX: 0, offsetY: 50 })
  })

  it('supports the normal board stretching to its assigned dimensions', () => {
    expect(getGridMetrics({ infinite: false, columns: 4, rows: 2 }, { width: 400, height: 300, cellSize: 56, fit: 'stretch' }))
      .toEqual({ cellWidth: 100, cellHeight: 150, width: 400, height: 300, offsetX: 0, offsetY: 0 })
  })

  it.each([0.1, 0.75, 1, 2.5, 5])('keeps negative cells and hit testing aligned at zoom %s', (zoom) => {
    const metrics = getGridMetrics({ infinite: true }, { width: 375, height: 600, cellSize: 56, fit: 'manual', zoom, offsetX: -23.7, offsetY: 67.3 })
    for (const column of [-100, -1, 0, 50]) {
      const point = gridCellToScreen(metrics, column, -8)
      expect(screenToGridCell(metrics, point.x + metrics.cellWidth / 2, point.y + metrics.cellHeight / 2)).toEqual({ column, row: -8 })
    }
    expect(metrics.width).toBe(375)
    expect(metrics.height).toBe(600)
  })

  it('rejects finite margins but accepts coordinates anywhere on an infinite grid', () => {
    const bounds = { infinite: false as const, columns: 4, rows: 2 }
    expect(isInsideGrid(bounds, -1, 0)).toBe(false)
    expect(isInsideGrid(bounds, 4, 0)).toBe(false)
    expect(isInsideGrid(bounds, 3, 1)).toBe(true)
    expect(isInsideGrid({ infinite: true }, -100, 999)).toBe(true)
  })
})
