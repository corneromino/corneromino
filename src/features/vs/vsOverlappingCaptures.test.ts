import { describe, expect, it } from 'vitest'
import { getTetrominoKind } from '@/game/tetrominoes'
import { createVsLocalGame, finishVsTurn, findValidatedVsShapes, getVsPlayerScores, goToVsHistory, selectVsCell, type VsCorner, type VsLocalGameState, type VsPlayerId } from './vsLocalGame'
import { getVsMoveNotations } from './vsMoveNotation'

function play(game: VsLocalGameState, column: number, row: number, corner: VsCorner) {
  let draft = selectVsCell(game, column, row)
  for (let rotation = 0; rotation < (corner + 3) % 4; rotation++) draft = selectVsCell(draft, column, row)
  return finishVsTurn(draft)
}

function reportedPosition(allowOverlappingCombinationWin = true) {
  let game = createVsLocalGame(() => 0, { allowOverlappingCombinationWin })
  game = play(game, 3, 4, 1)
  game = play(game, 4, 4, 2)
  game = play(game, 6, 4, 3)
  return play(game, 7, 4, 1)
}

function overlappingLine(shapeCount: number, dx: number, dy: number, player: VsPlayerId = 0, combinationWinCount = shapeCount) {
  const game = createVsLocalGame(() => player, { combinationWinCount, allowOverlappingCombinationWin: true })
  // The center is the missing top-left corner. Repeated orientations create
  // two, three, or four four-cell windows through it.
  const corners = [1, 2, 3, 0, 1, 2, 3] as const
  for (let index = 0; index < shapeCount + 3; index++) {
    const column = 1 + dx * index
    const row = (dy < 0 ? 8 : 1) + dy * index
    if (index === 3) game.pendingPlacement = { column, row, corner: 0 }
    else game.placedCornerominoes.push({ column, row, corner: corners[index], player: player === 0 ? 1 : 0 })
  }
  return game
}

describe('Local VS overlapping captures', () => {
  it('resolves the reported F4 move as two I captures worth five points', () => {
    const before = reportedPosition()
    const original = structuredClone(before)
    const after = play(before, 5, 4, 0)

    expect(after.lockedCornerominoes.map((shape) => [...shape.cellKeys].sort().join('|')).sort()).toEqual([
      '3,4|4,4|5,4|6,4', '4,4|5,4|6,4|7,4',
    ])
    expect(new Set(after.lockedCornerominoes.map((shape) => shape.id)).size).toBe(2)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([5, 0])
    expect(after.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
    expect(after.captureStreak).toEqual({ player: 0, turnCount: 1 })
    expect(after.pendingPlacement).toBeNull()
    expect(getVsMoveNotations(after.history.positions).at(-1)?.notation).toBe('F4D+D4E4F4G4H4')
    expect(before).toEqual(original)
  })

  it.each([
    ['horizontal', 1, 0, 'I'], ['vertical', 0, 1, 'I'],
    ['downward diagonal', 1, 1, 'diagonal'], ['upward diagonal', 1, -1, 'diagonal'],
  ] as const)('counts double, triple, and quadruple %s captures for either player', (_direction, dx, dy, kind) => {
    for (const player of [0, 1] as const) {
      for (const shapeCount of [2, 3, 4]) {
        const before = overlappingLine(shapeCount, dx, dy, player)
        const after = finishVsTurn(before)
        expect(after.lockedCornerominoes).toHaveLength(shapeCount)
        expect(new Set(after.lockedCornerominoes.map((shape) => [...shape.cellKeys].sort().join('|'))).size).toBe(shapeCount)
        expect(getVsPlayerScores(after.placedCornerominoes)[player]).toBe(shapeCount + 3)
        expect(getVsPlayerScores(after.placedCornerominoes)[player === 0 ? 1 : 0]).toBe(0)
        expect(after.result).toEqual({ reason: 'combination', winner: player, shapeCount })
        expect(after.captureStreak).toEqual({ player, turnCount: 1 })
        for (const shape of after.lockedCornerominoes) {
          expect(shape.cellKeys).toContain(`${before.pendingPlacement!.column},${before.pendingPlacement!.row}`)
          expect(getTetrominoKind(shape.cellKeys.map((key) => {
            const [x, y] = key.split(',').map(Number)
            return { x, y }
          }))).toBe(kind)
        }
      }
    }
  })

  it('counts a double as one capturing turn when the combination threshold is higher', () => {
    const before = overlappingLine(2, 1, 0, 0, 3)
    const after = finishVsTurn(before)
    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(after.captureStreak).toEqual({ player: 0, turnCount: 1 })
    expect(after.activePlayer).toBe(1)
    expect(after.result).toBeNull()

    const consecutive = finishVsTurn({ ...before, captureStreak: { player: 0, turnCount: 1 } })
    expect(consecutive.result).toEqual({ reason: 'consecutive-turns', winner: 0, turnCount: 2 })
  })

  it('locks and scores the reported F4 double without a combination win when overlaps are disabled', () => {
    const before = reportedPosition(false)
    const after = play(before, 5, 4, 0)
    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([5, 0])
    expect(after.captureStreak).toEqual({ player: 0, turnCount: 1 })
    expect(after.activePlayer).toBe(1)
    expect(after.result).toBeNull()
    expect(after.allowOverlappingCombinationWin).toBe(false)
    expect(getVsMoveNotations(after.history.positions).at(-1)?.notation).toBe('F4D+D4E4F4G4H4')

    const past = goToVsHistory(after, 4)
    expect(past.allowOverlappingCombinationWin).toBe(false)
    expect(goToVsHistory(past, 5)).toEqual(after)
    expect(play(past, 5, 4, 0)).toEqual(after)
  })

  it.each([[1, 0], [0, 1], [1, 1], [1, -1]])('counts only compatible line captures along %s,%s when overlap combinations are disabled', (dx, dy) => {
    for (const player of [0, 1] as const) {
      for (const shapeCount of [2, 3, 4]) {
        const before = { ...overlappingLine(shapeCount, dx, dy, player, 2), allowOverlappingCombinationWin: false }
        const after = finishVsTurn(before)
        expect(after.lockedCornerominoes).toHaveLength(shapeCount)
        expect(getVsPlayerScores(after.placedCornerominoes)[player]).toBe(shapeCount + 3)
        // With seven cells, the two outer windows share only the new center;
        // the two middle windows still lock but cannot increase the win count.
        expect(after.result).toEqual(shapeCount === 4 ? { reason: 'combination', winner: player, shapeCount: 2 } : null)
        expect(finishVsTurn({ ...before, combinationWinCount: 3 }).result).toBeNull()
      }
    }
  })

  it('still awards consecutive-turn victory for an overlapping capture when overlap combinations are disabled', () => {
    const before = { ...overlappingLine(2, 1, 0), allowOverlappingCombinationWin: false }
    const after = finishVsTurn({ ...before, captureStreak: { player: 0, turnCount: 1 } })
    expect(after.result).toEqual({ reason: 'consecutive-turns', winner: 0, turnCount: 2 })
    expect(after.lockedCornerominoes).toHaveLength(2)
  })

  it.each(['points', 'draw'] as const)('falls through to the %s trap rule when an overlapping combination is disabled', (trapResolution) => {
    const before = { ...overlappingLine(2, 1, 0), allowOverlappingCombinationWin: false, trapResolution }
    const pending = before.pendingPlacement!
    // Block every next-turn target. Repeating the new corner prevents extra captures.
    for (let row = 0; row < 10; row++) {
      for (let column = 0; column < 10; column++) {
        if (column !== pending.column && row !== pending.row) continue
        if (column === pending.column && row === pending.row) continue
        if (before.placedCornerominoes.some((cell) => cell.column === column && cell.row === row)) continue
        before.placedCornerominoes.push({ column, row, corner: 0, player: 1 })
      }
    }
    const after = finishVsTurn(before)
    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([5, 0])
    expect(after.result).toEqual({ reason: 'trap', winner: trapResolution === 'points' ? 0 : null })
  })

  it('restores overlapping lock groups, notation, and points when browsing and rewriting history', () => {
    const before = reportedPosition()
    const after = play(before, 5, 4, 0)
    const past = goToVsHistory(after, 4)
    expect(past.lockedCornerominoes).toEqual([])
    expect(getVsPlayerScores(past.placedCornerominoes)).toEqual([0, 0])
    expect(goToVsHistory(past, 5)).toEqual(after)

    const rewritten = play(past, 5, 4, 1)
    expect(rewritten.result).toBeNull()
    expect(rewritten.lockedCornerominoes).toEqual([])
    expect(getVsMoveNotations(rewritten.history.positions).at(-1)?.notation).toBe('F4A+')
    expect(getVsPlayerScores(after.placedCornerominoes)).toEqual([5, 0])
  })

  it('excludes shapes that do not contain the new cell and never reuses a previously locked cell', () => {
    const before = overlappingLine(3, 1, 0)
    const latest = { ...before.pendingPlacement!, player: before.activePlayer }
    // Lock an endpoint: only its window is disqualified; the other two still count.
    before.placedCornerominoes[0].lockedBy = 1
    const shapes = findValidatedVsShapes([...before.placedCornerominoes, latest], latest, [])
    expect(shapes).toHaveLength(2)
    expect(shapes.flat()).not.toContain('1,1')

    const distant = { column: 9, row: 9, corner: 0, player: 0 } as const
    expect(findValidatedVsShapes([...before.placedCornerominoes, latest, distant], distant, [])).toEqual([])
  })
})
