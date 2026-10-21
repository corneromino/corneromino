import { describe, expect, it } from 'vitest'
import { VS_LOCAL_CONFIG } from './vsLocalConfig'
import { createVsLocalGame, finishVsTurn, getVsAllowedCells, getVsNextTurnPreviewCells, getVsTargetedCells, selectVsCell, toggleVsMoveDirection, type VsLocalGameState, type VsPlayerId } from './vsLocalGame'

function combinationSetup(shapeCount: number, combinationWinCount = 2, player: VsPlayerId = 0): VsLocalGameState {
  const game = createVsLocalGame(() => player, { combinationWinCount })
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]
  for (const [dx, dy] of directions.slice(0, shapeCount)) {
    for (const corner of [1, 2, 3] as const) {
      game.placedCornerominoes.push({ column: 4 + dx * corner, row: 4 + dy * corner, corner, player: player === 0 ? 1 : 0 })
    }
  }
  game.pendingPlacement = { column: 4, row: 4, corner: 0 }
  return game
}

describe('Local VS combination victory', () => {
  it('starts unfinished with the configured default threshold', () => {
    const game = createVsLocalGame()
    expect(game.combinationWinCount).toBe(VS_LOCAL_CONFIG.combinationWinCount)
    expect(game.result).toBeNull()
  })

  it.each([0, 1] as const)('awards a double lock to player %s on confirmation', (player) => {
    const before = combinationSetup(2, 2, player)
    const after = finishVsTurn(before)

    expect(before.result).toBeNull()
    expect(before.lockedCornerominoes).toEqual([])
    expect(before.placedCornerominoes.every((cell) => cell.lockedBy === undefined)).toBe(true)
    expect(after.result).toEqual({ reason: 'combination', winner: player, shapeCount: 2 })
    expect(after.activePlayer).toBe(player)
    expect(after.pendingPlacement).toBeNull()
    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(after.placedCornerominoes.filter((cell) => cell.lockedBy === player)).toHaveLength(7)
  })

  it.each([
    [1, 2, false],
    [2, 3, false],
    [3, 3, true],
    [3, 4, false],
    [8, 3, true],
  ] as const)('resolves %s locks with a threshold of %s (victory: %s)', (shapeCount, threshold, victory) => {
    const game = finishVsTurn(combinationSetup(shapeCount, threshold))
    expect(game.lockedCornerominoes).toHaveLength(shapeCount)
    expect(game.combinationWinCount).toBe(threshold)
    expect(game.result).toEqual(victory ? { reason: 'combination', winner: 0, shapeCount } : null)
    expect(game.activePlayer).toBe(victory ? 0 : 1)
    // Several shapes in one turn advance the consecutive-turn streak only once.
    expect(game.captureStreak).toEqual({ player: 0, turnCount: 1 })
  })

  it('records combination victory when the same turn also completes a capture streak', () => {
    const before = combinationSetup(2)
    before.captureStreak = { player: 0, turnCount: 1 }
    const after = finishVsTurn(before)
    expect(after.captureStreak).toEqual({ player: 0, turnCount: 2 })
    expect(after.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
  })

  it('does not award a victory for shapes rejected by the friendly adjacency rule', () => {
    const game = combinationSetup(2)
    const cellKeys: string[] = []
    // A friendly O touches the left I only, leaving just the right I eligible.
    for (const [column, row, corner] of [[0, 3, 0], [1, 3, 1], [0, 2, 2], [1, 2, 3]] as const) {
      cellKeys.push(`${column},${row}`)
      game.placedCornerominoes.push({ column, row, corner, player: 0, lockedBy: 0 })
    }
    game.lockedCornerominoes.push({ id: 'lock:1', player: 0, cellKeys })
    const after = finishVsTurn(game)
    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(after.result).toBeNull()
  })

  it('freezes a finished match and removes legal-cell indicators', () => {
    const game = finishVsTurn(combinationSetup(2))
    expect(selectVsCell(game, 4, 0)).toBe(game)
    expect(toggleVsMoveDirection(game)).toBe(game)
    expect(finishVsTurn(game)).toBe(game)
    expect(getVsAllowedCells(game)).toEqual([])
    expect(getVsTargetedCells(game)).toEqual([])
    expect(getVsNextTurnPreviewCells(game)).toEqual([])

    // Even a stale pending input cannot rotate, change direction, or commit after a win.
    const stale = { ...game, pendingPlacement: { column: 4, row: 0, corner: 1 as const } }
    expect(selectVsCell(stale, 4, 0)).toBe(stale)
    expect(toggleVsMoveDirection(stale)).toBe(stale)
    expect(finishVsTurn(stale)).toBe(stale)
    expect(getVsNextTurnPreviewCells(stale)).toEqual([])
  })

  it('starts a playable rematch with the same threshold and no previous result', () => {
    const finished = finishVsTurn(combinationSetup(3, 3))
    const rematch = createVsLocalGame(() => 1, { combinationWinCount: finished.combinationWinCount })
    expect(rematch.combinationWinCount).toBe(3)
    expect(rematch.activePlayer).toBe(1)
    expect(rematch.result).toBeNull()
    expect(rematch.lockedCornerominoes).toEqual([])
    expect(rematch.placedCornerominoes).toEqual([])
    expect(selectVsCell(rematch, 4, 4).pendingPlacement).not.toBeNull()
  })

  it('does not turn an isolated single lock with no opponent targets into a combination win', () => {
    const game = createVsLocalGame(() => 0, { combinationWinCount: 2 })
    game.pendingPlacement = { column: 0, row: 0, corner: 0 }
    game.pendingMoveDirection = 'diagonal'
    for (let index = 1; index < 10; index += 1) {
      game.placedCornerominoes.push({ column: index, row: index, corner: index === 1 ? 1 : index === 2 ? 2 : 3, player: 1 })
    }
    const after = finishVsTurn(game)
    expect(after.lockedCornerominoes).toHaveLength(1)
    expect(getVsAllowedCells(after)).toEqual([])
    expect(after.result).toEqual({ reason: 'trap', winner: 0 })
  })

  it.each([0, 1, -1, 2.5, Infinity, NaN])('rejects an invalid combination threshold: %s', (combinationWinCount) => {
    expect(() => createVsLocalGame(Math.random, { combinationWinCount })).toThrow(RangeError)
  })
})
