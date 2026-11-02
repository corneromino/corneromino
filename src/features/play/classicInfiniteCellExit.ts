import type { LockedCellGroup, PlacedTetromino, PlacedTetrominoCell } from '@/game/gameConfig'
import type { TetrominoKind } from '@/game/tetrominoes'

export interface ClassicInfiniteCellExit {
  cell: PlacedTetrominoCell
  cellKey: string
  nokomino: PlacedTetromino
  nokominoCellKeys: readonly string[]
  nokominoId: number
  nokominoKind: TetrominoKind
  locked: boolean
  lockedGroupId: string | null
  selected: boolean
}

interface CollectExitedCellsOptions {
  lockedCellGroups: readonly LockedCellGroup[]
  offsetRows: number
  pieces: readonly PlacedTetromino[]
  reportedCellKeys: Set<string>
  selectedCellKeys: ReadonlySet<string>
  selectedLockedGroupId: string | null
  visibleRows: number
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

/**
 * Report each individual cell once its top edge reaches the viewport bottom.
 * Cells above the viewport are intentionally ignored: Infinite only flows down.
 */
export function collectExitedInfiniteCells(options: CollectExitedCellsOptions): ClassicInfiniteCellExit[] {
  const lockedCells = new Map(options.lockedCellGroups.flatMap((group) => group.cellKeys.map((key) => [key, group] as const)))
  const exited: ClassicInfiniteCellExit[] = []

  for (const nokomino of options.pieces) {
    const nokominoCellKeys = nokomino.cells.map((cell) => cellKey(cell.x, cell.y))
    for (let index = 0; index < nokomino.cells.length; index += 1) {
      const cell = nokomino.cells[index]!
      const key = nokominoCellKeys[index]!
      if (options.reportedCellKeys.has(key) || cell.y + options.offsetRows < options.visibleRows) continue

      const lockedGroup = lockedCells.get(key)
      options.reportedCellKeys.add(key)
      exited.push({
        cell,
        cellKey: key,
        nokomino,
        nokominoCellKeys,
        nokominoId: nokomino.id,
        nokominoKind: nokomino.kind,
        locked: lockedGroup !== undefined,
        lockedGroupId: lockedGroup?.id ?? null,
        selected: options.selectedCellKeys.has(key) || lockedGroup?.id === options.selectedLockedGroupId,
      })
    }
  }

  return exited
}

/** Keep the once-only tracking bounded to the two active stream sections. */
export function pruneReportedInfiniteCells(reportedCellKeys: Set<string>, pieces: readonly PlacedTetromino[]) {
  const activeCellKeys = new Set(pieces.flatMap((piece) => piece.cells.map((cell) => cellKey(cell.x, cell.y))))
  for (const key of reportedCellKeys) if (!activeCellKeys.has(key)) reportedCellKeys.delete(key)
}
