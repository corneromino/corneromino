import { describe, expect, it } from 'vitest'
import { VS_LOCAL_CONFIG } from './vsLocalConfig'
import { createVsLocalGame, finishVsTurn, getVsAllowedCells, selectVsCell, toggleVsMoveDirection, type VsLocalGameState, type VsPlayerId } from './vsLocalGame'

function preparedGame(player: VsPlayerId = 0, consecutiveTurnWinCount = 2): VsLocalGameState {
  const game = createVsLocalGame(() => player, { consecutiveTurnWinCount })
  // Three incomplete I shapes. The fourth column allows legal alternating moves
  // between captures, without accidentally completing another shape.
  for (const row of [1, 4, 7]) {
    for (const corner of [1, 2, 3] as const) {
      game.placedCornerominoes.push({ column: corner, row, corner, player: player === 0 ? 1 : 0 })
    }
  }
  return game
}

function captureOnRow(game: VsLocalGameState, row: number): VsLocalGameState {
  let selected = selectVsCell(game, 4, row)
  // Top-right -> bottom-right -> bottom-left -> top-left (the missing corner).
  for (let rotation = 0; rotation < 3; rotation += 1) selected = selectVsCell(selected, 4, row)
  expect(selected.pendingPlacement).toEqual({ column: 4, row, corner: 0 })
  return finishVsTurn(selected)
}

function quietTurn(game: VsLocalGameState, row: number): VsLocalGameState {
  const selected = selectVsCell(game, 4, row)
  expect(selected.pendingPlacement).toEqual({ column: 4, row, corner: 1 })
  const next = finishVsTurn(selected)
  expect(next.lockedCornerominoes).toHaveLength(game.lockedCornerominoes.length)
  return next
}

describe('Local VS consecutive-turn victory', () => {
  it('starts with no streak and the configured default of two turns', () => {
    const game = createVsLocalGame()
    expect(VS_LOCAL_CONFIG.consecutiveTurnWinCount).toBe(2)
    expect(game.consecutiveTurnWinCount).toBe(2)
    expect(game.captureStreak).toBeNull()
  })

  it.each([0, 1] as const)('lets player %s win on their second consecutive capture turn', (player) => {
    const before = preparedGame(player)
    const first = captureOnRow(before, 1)
    expect(before.captureStreak).toBeNull()
    expect(first.captureStreak).toEqual({ player, turnCount: 1 })
    expect(first.result).toBeNull()

    const opponentMiss = quietTurn(first, 2)
    expect(opponentMiss.captureStreak).toEqual(first.captureStreak)
    expect(opponentMiss.result).toBeNull()

    const finished = captureOnRow(opponentMiss, 4)
    expect(finished.result).toEqual({ reason: 'consecutive-turns', winner: player, turnCount: 2 })
    expect(finished.captureStreak).toEqual({ player, turnCount: 2 })
    expect(finished.activePlayer).toBe(player)
    expect(finished.pendingPlacement).toBeNull()
    expect(finished.lockedCornerominoes).toHaveLength(2)
    expect(finished.placedCornerominoes.filter((cell) => cell.lockedBy === player)).toHaveLength(8)
    expect(selectVsCell(finished, 4, 9)).toBe(finished)
    expect(finishVsTurn(finished)).toBe(finished)
    expect(toggleVsMoveDirection(finished)).toBe(finished)
    expect(getVsAllowedCells(finished)).toEqual([])
  })

  it('honors a three-turn threshold', () => {
    const first = captureOnRow(preparedGame(0, 3), 1)
    const second = captureOnRow(quietTurn(first, 2), 4)
    expect(second.consecutiveTurnWinCount).toBe(3)
    expect(second.captureStreak).toEqual({ player: 0, turnCount: 2 })
    expect(second.result).toBeNull()
    const third = captureOnRow(quietTurn(second, 5), 7)
    expect(third.result).toEqual({ reason: 'consecutive-turns', winner: 0, turnCount: 3 })
  })

  it('replaces a streak with the opponent’s first capture instead of counting alternating captures', () => {
    const first = captureOnRow(preparedGame(), 1)
    const counter = captureOnRow(first, 4)
    expect(counter.captureStreak).toEqual({ player: 1, turnCount: 1 })
    expect(counter.result).toBeNull()
    const recapture = captureOnRow(counter, 7)
    expect(recapture.captureStreak).toEqual({ player: 0, turnCount: 1 })
    expect(recapture.result).toBeNull()
  })

  it('lets the counterattacking player win if their new streak goes unanswered', () => {
    const first = captureOnRow(preparedGame(), 1)
    const counter = captureOnRow(first, 4)
    const finished = captureOnRow(quietTurn(counter, 5), 7)
    expect(finished.result).toEqual({ reason: 'consecutive-turns', winner: 1, turnCount: 2 })
  })

  it('resets the streak when its owner ends a turn without locking', () => {
    const first = captureOnRow(preparedGame(), 1)
    const missed = quietTurn(quietTurn(first, 2), 3)
    expect(missed.captureStreak).toBeNull()
    expect(missed.result).toBeNull()
    const restarted = captureOnRow(quietTurn(missed, 5), 4)
    expect(restarted.captureStreak).toEqual({ player: 0, turnCount: 1 })
    expect(restarted.result).toBeNull()
  })

  it('does not change a streak while selecting, rotating, or changing direction', () => {
    const first = captureOnRow(preparedGame(), 1)
    expect(finishVsTurn(first)).toBe(first)
    const selected = selectVsCell(first, 4, 2)
    const rotated = selectVsCell(selected, 4, 2)
    const toggled = toggleVsMoveDirection(rotated)
    expect(selected.captureStreak).toEqual(first.captureStreak)
    expect(rotated.captureStreak).toEqual(first.captureStreak)
    expect(toggled.captureStreak).toEqual(first.captureStreak)
    expect(toggled.result).toBeNull()
  })

  it('treats a shape blocked by friendly adjacency as a missed capture turn', () => {
    const first = captureOnRow(preparedGame(), 1)
    const game = quietTurn(first, 2)
    const cells = [[2, 5, 0], [1, 6, 1], [2, 6, 2], [3, 6, 3]] as const
    game.lockedCornerominoes.push({ id: 'old-t', player: 0, cellKeys: cells.map(([x, y]) => `${x},${y}`) })
    for (const [column, row, corner] of cells) {
      game.placedCornerominoes.push({ column, row, corner, player: 0, lockedBy: 0 })
    }
    const after = captureOnRow(game, 4)
    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(after.captureStreak).toBeNull()
    expect(after.result).toBeNull()
  })

  it('starts rematches without a streak and preserves both victory thresholds', () => {
    const config = { combinationWinCount: 4, consecutiveTurnWinCount: 3 }
    const rematch = createVsLocalGame(() => 1, config)
    expect(rematch).toMatchObject({ ...config, activePlayer: 1, captureStreak: null, result: null })
  })

  it.each([0, 1, -1, 2.5, Infinity, NaN])('rejects an invalid consecutive-turn threshold: %s', (consecutiveTurnWinCount) => {
    expect(() => createVsLocalGame(Math.random, { consecutiveTurnWinCount })).toThrow(RangeError)
  })
})
