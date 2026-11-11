import type { LockedCellGroup, PlacedTetromino, PlacedTetrominoCell } from '@/game/gameConfig'
import type { TetrominoKind } from '@/game/tetrominoes'

export interface ClassicInfiniteCellExit {
  cell: PlacedTetrominoCell
  cellKey: string
  piece: PlacedTetromino
  pieceCellKeys: readonly string[]
  pieceId: number
  pieceKind: TetrominoKind
  locked: boolean
  /** A locked group protects health only when it has all four corner types. */
  lockedHasUniqueCorners: boolean
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

function hasUniqueCorners(cellKeys: readonly string[], pieces: readonly PlacedTetromino[]) {
  const cornerByCellKey = new Map(pieces.flatMap((piece) => piece.cells.map((cell) => [cellKey(cell.x, cell.y), cell.corner] as const)))
  const corners = cellKeys.map((key) => cornerByCellKey.get(key))
  return corners.length === 4 && corners.every((corner) => corner !== undefined) && new Set(corners).size === 4
}

/**
 * Report each individual cell once its top edge reaches the viewport bottom.
 * Cells above the viewport are intentionally ignored: Infinite only flows down.
 */
export function collectExitedInfiniteCells(options: CollectExitedCellsOptions): ClassicInfiniteCellExit[] {
  const lockedCells = new Map(options.lockedCellGroups.flatMap((group) => group.cellKeys.map((key) => [key, group] as const)))
  const exited: ClassicInfiniteCellExit[] = []

  for (const piece of options.pieces) {
    const pieceCellKeys = piece.cells.map((cell) => cellKey(cell.x, cell.y))
    for (let index = 0; index < piece.cells.length; index += 1) {
      const cell = piece.cells[index]!
      const key = pieceCellKeys[index]!
      if (options.reportedCellKeys.has(key) || cell.y + options.offsetRows < options.visibleRows) continue

      const lockedGroup = lockedCells.get(key)
      const lockedHasUniqueCorners = lockedGroup !== undefined && hasUniqueCorners(lockedGroup.cellKeys, options.pieces)
      options.reportedCellKeys.add(key)
      exited.push({
        cell,
        cellKey: key,
        piece,
        pieceCellKeys,
        pieceId: piece.id,
        pieceKind: piece.kind,
        locked: lockedGroup !== undefined,
        lockedHasUniqueCorners,
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
