export type GridBounds = { infinite: true } | { infinite: false; columns: number; rows: number }

export interface GridViewport {
  width: number
  height: number
  cellSize: number
  fit: 'contain' | 'stretch' | 'manual'
  zoom?: number
  offsetX?: number
  offsetY?: number
}

export interface GridMetrics {
  cellWidth: number
  cellHeight: number
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export function getGridMetrics(bounds: GridBounds, viewport: GridViewport): GridMetrics {
  let cellWidth = viewport.cellSize * (viewport.zoom ?? 1)
  let cellHeight = cellWidth
  if (!bounds.infinite && viewport.fit !== 'manual') {
    cellWidth = viewport.width / bounds.columns
    cellHeight = viewport.height / bounds.rows
    if (viewport.fit === 'contain') cellWidth = cellHeight = Math.min(cellWidth, cellHeight)
  }
  const width = bounds.infinite ? viewport.width : bounds.columns * cellWidth
  const height = bounds.infinite ? viewport.height : bounds.rows * cellHeight
  return {
    cellWidth,
    cellHeight,
    width,
    height,
    offsetX: viewport.offsetX ?? (bounds.infinite ? 0 : (viewport.width - width) / 2),
    offsetY: viewport.offsetY ?? (bounds.infinite ? 0 : (viewport.height - height) / 2),
  }
}

export function gridCellToScreen(metrics: GridMetrics, column: number, row: number) {
  return { x: metrics.offsetX + column * metrics.cellWidth, y: metrics.offsetY + row * metrics.cellHeight }
}

export function screenToGridCell(metrics: GridMetrics, x: number, y: number) {
  return { column: Math.floor((x - metrics.offsetX) / metrics.cellWidth), row: Math.floor((y - metrics.offsetY) / metrics.cellHeight) }
}

export function isInsideGrid(bounds: GridBounds, column: number, row: number) {
  return bounds.infinite || (column >= 0 && row >= 0 && column < bounds.columns && row < bounds.rows)
}
