import type { VsLocalPosition, VsPlayerId } from './vsLocalGame'

export interface VsMoveNotation {
  historyIndex: number
  moveNumber: number
  notation: string
  player: VsPlayerId
}

// Internal corners start at top-left; notation starts at top-right.
export const VS_CORNER_LETTERS = ['D', 'A', 'B', 'C'] as const

export function formatVsCoordinate(cell: { column: number; row: number }): string {
  return `${String.fromCharCode(65 + cell.column)}${cell.row}`
}

/** Saved positions already retain the placement, chosen direction, and lock ownership. */
export function getVsMoveNotations(positions: readonly VsLocalPosition[]): VsMoveNotation[] {
  const moves: VsMoveNotation[] = []
  // The first snapshot is the baseline, including for saves predating history.
  for (let historyIndex = 1; historyIndex < positions.length; historyIndex += 1) {
    const before = positions[historyIndex - 1]
    const after = positions[historyIndex]
    const placed = after.placedCornerominoes.at(-1)
    if (!placed || !after.nextMoveConstraint) continue

    const previouslyLocked = new Set(before.placedCornerominoes
      .filter((cell) => cell.lockedBy !== undefined)
      .map(formatVsCoordinate))
    const lockedCells = after.placedCornerominoes
      .filter((cell) => cell.lockedBy !== undefined && !previouslyLocked.has(formatVsCoordinate(cell)))
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .map(formatVsCoordinate)
      .join('')
    const direction = after.nextMoveConstraint.direction === 'orthogonal' ? '+' : 'x'
    moves.push({
      historyIndex,
      moveNumber: after.placedCornerominoes.length,
      notation: `${formatVsCoordinate(placed)}${VS_CORNER_LETTERS[placed.corner]}${direction}${lockedCells}`,
      player: placed.player,
    })
  }
  return moves
}
