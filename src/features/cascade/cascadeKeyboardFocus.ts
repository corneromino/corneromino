import type { CascadePiece } from './cascadeGame'

export type CascadeFocusPosition = Pick<CascadePiece, 'column' | 'row'>
export type CascadeFocusDirection = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

/** Move horizontally to the nearest piece on that side, or vertically within a column. */
export function getCascadeKeyboardFocus(
  pieces: readonly CascadePiece[],
  lockedCells: Pick<ReadonlySet<string>, 'has'>,
  current: CascadeFocusPosition | null,
  direction?: CascadeFocusDirection,
): CascadeFocusPosition | null {
  const available = pieces.filter((piece) => !lockedCells.has(`${piece.column},${piece.row}`))
  const anchor = available.find((piece) => piece.column === current?.column && piece.row === current.row)
  if (!anchor) {
    // Start at the bottom-left; recover near the previous focus after locking.
    available.sort((a, b) => {
      const distance = (piece: CascadePiece) => current
        ? Math.abs(piece.column - current.column) + Math.abs(piece.row - current.row)
        : 0
      return distance(a) - distance(b) || b.row - a.row || a.column - b.column
    })
    return available[0] ?? null
  }
  if (!direction) return anchor

  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight'
  const sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1
  const distance = (piece: CascadePiece) => sign * (horizontal ? piece.column - anchor.column : piece.row - anchor.row)
  const candidates = available.filter((piece) => (
    (horizontal || piece.column === anchor.column) && distance(piece) > 0
  ))

  // For left/right, compare every piece strictly on that side by distance,
  // without favoring the current row over closer pieces above or below.
  const spatialDistance = (piece: CascadePiece) => (
    (piece.column - anchor.column) ** 2 + (piece.row - anchor.row) ** 2
  )
  candidates.sort((a, b) => (
    spatialDistance(a) - spatialDistance(b) || distance(a) - distance(b) || a.row - b.row
  ))
  return candidates[0] ?? anchor
}
