import { gridCellToScreen, type GridMetrics } from './gridGeometry'

interface Point { x: number; y: number }

/** Center a lock ripple in canvas coordinates, including the grid's pan and zoom. */
export function getLockRippleCenter(metrics: GridMetrics, origin: Point, cells: readonly Point[]): Point {
  const sum = cells.reduce((total, cell) => ({ x: total.x + cell.x + 0.5, y: total.y + cell.y + 0.5 }), { x: 0, y: 0 })
  const center = gridCellToScreen(metrics, sum.x / cells.length, sum.y / cells.length)
  return { x: origin.x + center.x, y: origin.y + center.y }
}
