import type { GridMetrics } from '@/rendering/grid/gridGeometry'
import type { VsLockedCorneromino, VsPlayerId } from './vsLocalGame'

interface LockedShapeBridge {
  x: number
  y: number
  width: number
  height: number
  player: VsPlayerId
}

/** Fills internal grid seams using lock-group membership, not just matching colours. */
export function getVsLockedShapeBridges(
  groups: readonly VsLockedCorneromino[],
  metrics: GridMetrics,
  borderSize: number,
): LockedShapeBridge[] {
  const { cellWidth, cellHeight, offsetX, offsetY } = metrics
  // Slightly overlap the existing bodies to avoid antialiased hairline seams.
  const overlap = Math.max(0.5, Math.min(cellWidth, cellHeight) * 0.02 - borderSize)
  const reach = borderSize + overlap
  const bridges: LockedShapeBridge[] = []

  for (const group of groups) {
    const keys = new Set(group.cellKeys)
    const cells = group.cellKeys.map((key) => {
      const [column, row] = key.split(',').map(Number)
      return { column, row }
    })
    const diagonal = cells.every((cell) => cell.column - cell.row === cells[0]!.column - cells[0]!.row)
      || cells.every((cell) => cell.column + cell.row === cells[0]!.column + cells[0]!.row)

    for (const { column, row } of cells) {
      const x = offsetX + column * cellWidth
      const y = offsetY + row * cellHeight
      const right = keys.has(`${column + 1},${row}`)
      const below = keys.has(`${column},${row + 1}`)
      if (right) {
        bridges.push({ x: x + cellWidth - reach, y: y + borderSize, width: reach * 2, height: cellHeight - borderSize * 2, player: group.player })
      }
      if (below) {
        bridges.push({ x: x + borderSize, y: y + cellHeight - reach, width: cellWidth - borderSize * 2, height: reach * 2, player: group.player })
      }
      // An O shape also needs the four-way intersection filled, otherwise
      // the shared cell borders leave a small brown hole at its centre.
      if (right && below && keys.has(`${column + 1},${row + 1}`)) {
        bridges.push({ x: x + cellWidth - reach, y: y + cellHeight - reach, width: reach * 2, height: reach * 2, player: group.player })
      }
      if (diagonal) {
        for (const dx of [-1, 1]) {
          if (!keys.has(`${column + dx},${row + 1}`)) continue
          bridges.push({ x: x + (dx === 1 ? cellWidth : 0) - reach, y: y + cellHeight - reach, width: reach * 2, height: reach * 2, player: group.player })
        }
      }
    }
  }

  return bridges
}
