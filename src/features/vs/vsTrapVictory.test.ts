import { describe, expect, it } from 'vitest'
import { type VsTrapResolution } from './vsLocalConfig'
import { createVsLocalGame, finishVsTurn, getVsAllowedCells, getVsNextTurnPreviewCells, getVsPlayerScores, getVsTargetedCells, selectVsCell, toggleVsMoveDirection, type VsLocalGameState, type VsMoveDirection, type VsPlayerId } from './vsLocalGame'

function trapSetup(direction: VsMoveDirection, player: VsPlayerId = 0, trapResolution: VsTrapResolution = 'points'): VsLocalGameState {
  const game = createVsLocalGame(() => player, { trapResolution })
  game.pendingPlacement = { column: 0, row: 0, corner: 0 }
  game.pendingMoveDirection = direction
  for (let index = 1; index < 10; index += 1) {
    game.placedCornerominoes.push({
      column: direction === 'diagonal' ? index : 0,
      row: index,
      corner: index === 1 ? 1 : index === 2 ? 2 : 3,
      player: player === 0 ? 1 : 0,
    })
    if (direction === 'orthogonal') game.placedCornerominoes.push({ column: index, row: 0, corner: 3, player })
  }
  return game
}

function addLockedSquare(game: VsLocalGameState, column: number, row: number, player: VsPlayerId) {
  const cells = [[column, row], [column + 1, row], [column, row + 1], [column + 1, row + 1]]
  const corners = [0, 1, 2, 3] as const
  game.lockedCornerominoes.push({ id: `old:${game.lockedCornerominoes.length}`, player, cellKeys: cells.map(([x, y]) => `${x},${y}`) })
  for (const [index, [x, y]] of cells.entries()) {
    if (!game.placedCornerominoes.some((cell) => cell.column === x && cell.row === y)) {
      game.placedCornerominoes.push({ column: x, row: y, corner: corners[index], player: player === 0 ? 1 : 0, lockedBy: player })
    }
  }
}

describe.each(['orthogonal', 'diagonal'] as const)('Local VS %s traps', (direction) => {
  it.each([0, 1] as const)('lets player %s win by points after their trapping capture', (player) => {
    const before = trapSetup(direction, player)
    expect(getVsNextTurnPreviewCells(before)).toEqual([])
    expect(before.result).toBeNull()
    const after = finishVsTurn(before)
    expect(after.result).toEqual({ reason: 'trap', winner: player })
    expect(after.lockedCornerominoes).toHaveLength(1)
    expect(getVsPlayerScores(after.placedCornerominoes)[player]).toBe(4)
    expect(after.pendingPlacement).toBeNull()
    expect(getVsAllowedCells({ ...after, result: null })).toEqual([])
    expect(before.lockedCornerominoes).toEqual([])
    expect(before.placedCornerominoes.every((cell) => cell.lockedBy === undefined)).toBe(true)
  })

  it.each([0, 1] as const)('includes player %s’s final capture when comparing tied scores', (player) => {
    const before = trapSetup(direction, player)
    const opponent = player === 0 ? 1 : 0
    addLockedSquare(before, 6, 1, opponent)
    expect(getVsPlayerScores(before.placedCornerominoes)[player]).toBe(0)
    const after = finishVsTurn(before)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([4, 4])
    expect(after.result).toEqual({ reason: 'trap', winner: null })
  })

  it.each([0, 1] as const)('can award victory to the opponent of trapping player %s', (player) => {
    const before = trapSetup(direction, player)
    const opponent = player === 0 ? 1 : 0
    addLockedSquare(before, 6, 1, opponent)
    addLockedSquare(before, 6, 4, opponent)
    const after = finishVsTurn(before)
    expect(after.result).toEqual({ reason: 'trap', winner: opponent })
    expect(getVsPlayerScores(after.placedCornerominoes)[opponent]).toBe(8)
    expect(getVsPlayerScores(after.placedCornerominoes)[player]).toBe(4)
    expect(after.activePlayer).toBe(player)
  })

  it('always draws a trapping capture in draw mode, even with unequal points', () => {
    const after = finishVsTurn(trapSetup(direction, 0, 'draw'))
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([4, 0])
    expect(after.result).toEqual({ reason: 'trap', winner: null })
  })

  it.each(['points', 'draw'] as const)('draws a non-capturing block regardless of points in %s mode', (trapResolution) => {
    const before = trapSetup(direction, 0, trapResolution)
    for (const cell of before.placedCornerominoes) cell.corner = 3
    addLockedSquare(before, 6, 1, 0)
    const after = finishVsTurn(before)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([4, 0])
    expect(after.lockedCornerominoes).toHaveLength(1)
    expect(after.result).toEqual({ reason: 'no-legal-moves', winner: null })
  })

  it('continues if even one distant legal cell remains empty', () => {
    const before = trapSetup(direction)
    const column = direction === 'diagonal' ? 9 : 0
    before.placedCornerominoes = before.placedCornerominoes.filter((cell) => cell.column !== column || cell.row !== 9)
    const after = finishVsTurn(before)
    expect(after.result).toBeNull()
    expect(getVsAllowedCells(after)).toEqual([{ column, row: 9 }])
  })
})

describe('Local VS trap resolution', () => {
  it('defaults to comparing points and preserves the setting in a fresh match', () => {
    expect(createVsLocalGame().trapResolution).toBe('points')
    const finished = finishVsTurn(trapSetup('diagonal', 0, 'draw'))
    const rematch = createVsLocalGame(() => 1, { trapResolution: finished.trapResolution })
    expect(rematch.trapResolution).toBe('draw')
    expect(rematch.result).toBeNull()
    expect(rematch.placedCornerominoes).toEqual([])
  })

  it('uses the selected direction rather than an alternative blocked direction', () => {
    const before = trapSetup('diagonal')
    before.pendingMoveDirection = 'orthogonal'
    const after = finishVsTurn(before)
    expect(after.result).toBeNull()
    expect(getVsAllowedCells(after)).toHaveLength(18)
  })

  it('counts shared locked cells once and uses ownership rather than placement player', () => {
    const before = trapSetup('diagonal')
    addLockedSquare(before, 6, 1, 1)
    addLockedSquare(before, 7, 2, 1)
    addLockedSquare(before, 1, 7, 0)
    const after = finishVsTurn(before)
    expect(after.lockedCornerominoes.filter((shape) => shape.player === 0)).toHaveLength(2)
    expect(after.lockedCornerominoes.filter((shape) => shape.player === 1)).toHaveLength(2)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([8, 7])
    expect(after.result).toEqual({ reason: 'trap', winner: 0 })
  })

  it.each(['points', 'draw'] as const)('prioritizes combination victory over a trap in %s mode', (trapResolution) => {
    const before = trapSetup('orthogonal', 0, trapResolution)
    before.placedCornerominoes.find((cell) => cell.column === 1 && cell.row === 0)!.corner = 1
    before.placedCornerominoes.find((cell) => cell.column === 2 && cell.row === 0)!.corner = 2
    addLockedSquare(before, 6, 1, 1)
    addLockedSquare(before, 6, 4, 1)
    const after = finishVsTurn(before)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([7, 8])
    expect(after.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
  })

  it.each(['points', 'draw'] as const)('prioritizes consecutive-turn victory over a trap in %s mode', (trapResolution) => {
    const before = trapSetup('diagonal', 0, trapResolution)
    before.captureStreak = { player: 0, turnCount: 1 }
    addLockedSquare(before, 1, 7, 0)
    addLockedSquare(before, 6, 1, 1)
    addLockedSquare(before, 6, 4, 1)
    const after = finishVsTurn(before)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([8, 8])
    expect(after.result).toEqual({ reason: 'consecutive-turns', winner: 0, turnCount: 2 })
  })

  it.each([true, false])('resolves a completely full board (capture: %s)', (capture) => {
    const before = trapSetup('diagonal')
    for (let row = 0; row < 10; row += 1) {
      for (let column = 0; column < 10; column += 1) {
        if (column === row) continue
        before.placedCornerominoes.push({ column, row, corner: 3, player: 1 })
      }
    }
    if (!capture) for (const cell of before.placedCornerominoes) cell.corner = 3
    const after = finishVsTurn(before)
    expect(after.placedCornerominoes).toHaveLength(100)
    expect(after.result).toEqual(capture ? { reason: 'trap', winner: 0 } : { reason: 'no-legal-moves', winner: null })
  })

  it.each(['points', 'draw'] as const)('freezes finished traps and draws in %s mode', (trapResolution) => {
    const after = finishVsTurn(trapSetup('diagonal', 0, trapResolution))
    const stale = { ...after, pendingPlacement: { column: 4, row: 8, corner: 0 as const } }
    expect(selectVsCell(after, 4, 8)).toBe(after)
    expect(toggleVsMoveDirection(stale)).toBe(stale)
    expect(finishVsTurn(stale)).toBe(stale)
    expect(getVsAllowedCells(after)).toEqual([])
    expect(getVsTargetedCells(after)).toEqual([])
    expect(getVsNextTurnPreviewCells(stale)).toEqual([])
  })
})
