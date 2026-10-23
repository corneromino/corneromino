import { CELL_CORNERS } from '@/game/gameConfig'
import { getTetrominoKind } from '@/game/tetrominoes'
import { VS_LOCAL_CONFIG } from './vsLocalConfig'
import {
  canPlayVsTurn, getVsAllowedCells, getVsNextTurnPreviewCells, getVsPlayerScores, getVsTargetedCells, VS_PLAYERS,
  type VsLocalGameState, type VsLocalPosition, type VsPlacement,
} from './vsLocalGame'
import { formatVsCoordinate, getVsMoveNotations, VS_CORNER_LETTERS } from './vsMoveNotation'

export interface VsDebugContext {
  ui: { pauseOpen: boolean; victoryDialogDismissed: boolean }
  environment: {
    userAgent: string
    url: string
    buildMode: string
    scripts: string[]
    standalone: boolean
    viewport: { width: number; height: number; devicePixelRatio: number }
    visualViewport: { width: number; height: number; offsetLeft: number; offsetTop: number; scale: number } | null
  }
}

function describePlacement(placement: VsPlacement) {
  return {
    ...placement,
    coordinate: formatVsCoordinate(placement),
    cornerName: CELL_CORNERS[placement.corner],
    cornerLetter: VS_CORNER_LETTERS[placement.corner],
  }
}

function describePosition(position: VsLocalPosition) {
  const scores = getVsPlayerScores(position.placedCornerominoes)
  return {
    activePlayer: position.activePlayer,
    scores,
    pointDifferences: [scores[0] - scores[1], scores[1] - scores[0]],
    placedCellCount: position.placedCornerominoes.length,
    emptyCellCount: 100 - position.placedCornerominoes.length,
    lockedCellCount: scores[0] + scores[1],
    lockedShapeCount: position.lockedCornerominoes.length,
    captureStreak: position.captureStreak,
    nextMoveConstraint: position.nextMoveConstraint,
    result: position.result,
  }
}

/** Raw state is kept intact; derived details make a pasted report readable without running the game. */
export function exportVsDebugState(game: VsLocalGameState, context: VsDebugContext, exportedAt = new Date().toISOString()): string {
  const moves = getVsMoveNotations(game.history.positions)
  const moveByIndex = new Map(moves.map((move) => [move.historyIndex, move]))
  const canPlayTurn = canPlayVsTurn(game)

  return JSON.stringify({
    format: 'corneromino-debug',
    version: 1,
    mode: 'vs-local',
    exportedAt,
    legend: {
      board: { columns: 10, rows: 10, origin: 'A0 at screen top-left', columnDirection: 'right', rowDirection: 'down' },
      corners: CELL_CORNERS.map((name, value) => ({ value, name, notation: VS_CORNER_LETTERS[value] })),
      directions: { orthogonal: '+', diagonal: 'x' },
      players: VS_PLAYERS,
      scores: 'Cell-based points, indexed by player ID. lockedBy determines scoring ownership; player records who placed the cell.',
      captures: 'Every distinct valid shape containing the newly placed cell counts, including overlapping shapes. Previously locked cells cannot be reused; shared cells score once.',
      history: 'Index 0 is the saved baseline, which can already contain pieces in migrated saves. All retained future positions are included.',
      notation: '[column][row][corner letter][+ or x][newly locked coordinates, sorted by row then column]',
    },
    defaultConfig: VS_LOCAL_CONFIG,
    // Includes every field, the current draft, active match configuration, and all history snapshots.
    gameState: game,
    current: {
      ...describePosition(game),
      canPlayTurn,
      canFinishTurn: canPlayTurn && game.pendingPlacement !== null,
      placements: game.placedCornerominoes.map(describePlacement),
      lockedShapes: game.lockedCornerominoes.map((group) => {
        const cells = group.cellKeys.map((key) => {
          const [x, y] = key.split(',').map(Number)
          return { x, y }
        })
        return {
          ...group,
          kind: getTetrominoKind(cells),
          coordinates: cells.map(({ x, y }) => formatVsCoordinate({ column: x, row: y })),
        }
      }),
      pendingPlacement: game.pendingPlacement ? {
        ...describePlacement(game.pendingPlacement),
        player: game.activePlayer,
        direction: game.pendingMoveDirection,
        directionSymbol: game.pendingMoveDirection === 'orthogonal' ? '+' : 'x',
      } : null,
      allowedCells: getVsAllowedCells(game).map(formatVsCoordinate),
      targetedCells: getVsTargetedCells(game).map(formatVsCoordinate),
      nextTurnPreviewCells: getVsNextTurnPreviewCells(game).map(formatVsCoordinate),
    },
    history: {
      selectedIndex: game.history.index,
      latestIndex: game.history.positions.length - 1,
      viewingPast: game.history.index < game.history.positions.length - 1,
      baselinePlacedCellCount: game.history.positions[0]?.placedCornerominoes.length ?? 0,
      moves,
      positions: game.history.positions.map((position, historyIndex) => {
        const previous = game.history.positions[historyIndex - 1]
        const previouslyLocked = new Set(previous?.placedCornerominoes.filter((cell) => cell.lockedBy !== undefined).map(formatVsCoordinate))
        const move = moveByIndex.get(historyIndex)
        const placed = move ? position.placedCornerominoes.at(-1) : undefined
        return {
          historyIndex,
          selected: historyIndex === game.history.index,
          ...describePosition(position),
          move: move ? { ...move, placement: placed ? describePlacement(placed) : null } : null,
          newlyLockedCells: previous ? position.placedCornerominoes
            .filter((cell) => cell.lockedBy !== undefined && !previouslyLocked.has(formatVsCoordinate(cell)))
            .sort((a, b) => a.row - b.row || a.column - b.column)
            .map(formatVsCoordinate) : [],
        }
      }),
    },
    ...context,
  }, null, 2)
}
