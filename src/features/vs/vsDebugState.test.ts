import { describe, expect, it } from 'vitest'
import { exportVsDebugState, type VsDebugContext } from './vsDebugState'
import { createVsLocalGame, finishVsTurn, getVsHistoryPosition, goToVsHistory, selectVsCell, toggleVsMoveDirection, type VsCorner, type VsLocalGameState } from './vsLocalGame'

const CONTEXT: VsDebugContext = {
  ui: { pauseOpen: true, victoryDialogDismissed: false },
  environment: {
    userAgent: 'test-browser', url: 'https://example.test/#/vs/local', buildMode: 'test', scripts: ['https://example.test/assets/index-test.js'], standalone: true,
    viewport: { width: 390, height: 844, devicePixelRatio: 3 }, visualViewport: null,
  },
}
const EXPORTED_AT = '2026-10-23T12:00:00.000Z'

function report(game: VsLocalGameState) {
  return JSON.parse(exportVsDebugState(game, CONTEXT, EXPORTED_AT))
}

function play(game: VsLocalGameState, column: number, row: number, corner: VsCorner) {
  let draft = selectVsCell(game, column, row)
  for (let turn = 0; turn < (corner + 3) % 4; turn += 1) draft = selectVsCell(draft, column, row)
  return finishVsTurn(draft)
}

function squareGame(allowHistoryRewrite = true) {
  let game = createVsLocalGame(() => 0, { allowHistoryRewrite, combinationWinCount: 3, consecutiveTurnWinCount: 4, trapResolution: 'draw' })
  game = play(game, 0, 0, 0)
  game = play(game, 1, 0, 1)
  game = play(game, 1, 1, 2)
  return play(game, 0, 1, 3)
}

describe('Local VS debug report', () => {
  it('exports the complete state, orientations, ownership, lock groups, notation, scores, rules, and context without mutation', () => {
    const game = squareGame()
    const before = structuredClone(game)
    const exported = report(game)

    expect(exported).toMatchObject({ format: 'corneromino-debug', version: 1, mode: 'vs-local', exportedAt: EXPORTED_AT, ...CONTEXT })
    expect(exported.gameState).toEqual(before)
    expect(game).toEqual(before)
    expect(exported.gameState).toMatchObject({ combinationWinCount: 3, consecutiveTurnWinCount: 4, trapResolution: 'draw' })
    expect(exported.current.scores).toEqual([0, 4])
    expect(exported.current.pointDifferences).toEqual([-4, 4])
    expect(exported.current.captureStreak).toEqual({ player: 1, turnCount: 1 })
    expect(exported.current.placements).toEqual([
      { column: 0, row: 0, corner: 0, player: 0, lockedBy: 1, coordinate: 'A0', cornerName: 'top-left', cornerLetter: 'D' },
      { column: 1, row: 0, corner: 1, player: 1, lockedBy: 1, coordinate: 'B0', cornerName: 'top-right', cornerLetter: 'A' },
      { column: 1, row: 1, corner: 2, player: 0, lockedBy: 1, coordinate: 'B1', cornerName: 'bottom-right', cornerLetter: 'B' },
      { column: 0, row: 1, corner: 3, player: 1, lockedBy: 1, coordinate: 'A1', cornerName: 'bottom-left', cornerLetter: 'C' },
    ])
    expect(exported.current.lockedShapes[0]).toMatchObject({ ...game.lockedCornerominoes[0], kind: 'O' })
    expect(exported.history.moves.map((move: { notation: string }) => move.notation)).toEqual(['A0D+', 'B0A+', 'B1B+', 'A1C+A0B0A1B1'])
    expect(exported.history.positions[4]).toMatchObject({ scores: [0, 4], newlyLockedCells: ['A0', 'B0', 'A1', 'B1'] })
    expect(exported.history.positions[3].scores).toEqual([0, 0])
  })

  it('keeps future history while reporting the viewed position and unconfirmed draft separately', () => {
    const latest = squareGame()
    let game = selectVsCell(goToVsHistory(latest, 2), 1, 4)
    game = selectVsCell(game, 1, 4)
    game = toggleVsMoveDirection(game)
    const exported = report(game)

    expect(exported.gameState).toEqual(game)
    expect(exported.gameState.history.positions).toEqual(latest.history.positions)
    expect(exported.history).toMatchObject({ selectedIndex: 2, latestIndex: 4, viewingPast: true })
    expect(exported.history.moves).toHaveLength(4)
    expect(exported.current.scores).toEqual([0, 0])
    expect(exported.history.positions[4].scores).toEqual([0, 4])
    expect(exported.current.pendingPlacement).toEqual({ column: 1, row: 4, corner: 2, coordinate: 'B4', cornerName: 'bottom-right', cornerLetter: 'B', player: 0, direction: 'diagonal', directionSymbol: 'x' })
    expect(exported.current.canFinishTurn).toBe(true)
    expect(exported.current.allowedCells).toContain('B4')
    expect(exported.current.targetedCells).toEqual(exported.current.allowedCells)
    expect(exported.current.nextTurnPreviewCells).toContain('C5')
    expect(exported.current.nextTurnPreviewCells).not.toContain('B4')
  })

  it('reports view-only history independently of available board cells', () => {
    const exported = report(goToVsHistory(squareGame(false), 2))
    expect(exported.current.canPlayTurn).toBe(false)
    expect(exported.current.canFinishTurn).toBe(false)
    expect(exported.current.allowedCells.length).toBeGreaterThan(0)
    expect(exported.gameState.allowHistoryRewrite).toBe(false)
  })

  it('preserves terminal results and counts a shared capture cell only once in points', () => {
    const game = createVsLocalGame(() => 0)
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      for (const corner of [1, 2, 3] as const) {
        game.placedCornerominoes.push({ column: dx * corner, row: dy * corner, corner, player: 1 })
      }
    }
    game.pendingPlacement = { column: 0, row: 0, corner: 0 }
    const finished = finishVsTurn(game)
    const exported = report(finished)
    expect(exported.gameState).toEqual(finished)
    expect(exported.current).toMatchObject({
      result: { reason: 'combination', winner: 0, shapeCount: 2 },
      scores: [7, 0], lockedCellCount: 7, lockedShapeCount: 2, canPlayTurn: false, canFinishTurn: false,
      allowedCells: [], targetedCells: [], nextTurnPreviewCells: [],
    })
    expect(exported.current.lockedShapes).toHaveLength(2)
    expect(exported.history.positions.at(-1).newlyLockedCells).toHaveLength(7)
  })

  it('includes a populated legacy baseline without inventing missing moves', () => {
    const latest = squareGame()
    const migrated = { ...latest, history: { positions: [getVsHistoryPosition(latest)], index: 0 } }
    const exported = report(migrated)
    expect(exported.gameState.history.positions).toEqual(migrated.history.positions)
    expect(exported.history).toMatchObject({ baselinePlacedCellCount: 4, latestIndex: 0, selectedIndex: 0, moves: [] })
    expect(exported.history.positions[0]).toMatchObject({ move: null, scores: [0, 4], newlyLockedCells: [] })
  })
})
