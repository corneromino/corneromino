import type { LockedCellGroup, PlacedTetromino, PlacedTetrominoCell } from '@/game/gameConfig'
import type { TetrominoKind } from '@/game/tetrominoes'

export interface ClassicInfiniteCellExit {
  cell: PlacedTetrominoCell
  cellKey: string
  corneromino: PlacedTetromino
  cornerominoCellKeys: readonly string[]
  cornerominoId: number
  cornerominoKind: TetrominoKind
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

  for (const corneromino of options.pieces) {
    const cornerominoCellKeys = corneromino.cells.map((cell) => cellKey(cell.x, cell.y))
    for (let index = 0; index < corneromino.cells.length; index += 1) {
      const cell = corneromino.cells[index]!
      const key = cornerominoCellKeys[index]!
      if (options.reportedCellKeys.has(key) || cell.y + options.offsetRows < options.visibleRows) continue

      const lockedGroup = lockedCells.get(key)
      options.reportedCellKeys.add(key)
      exited.push({
        cell,
        cellKey: key,
        corneromino,
        cornerominoCellKeys,
        cornerominoId: corneromino.id,
        cornerominoKind: corneromino.kind,
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
