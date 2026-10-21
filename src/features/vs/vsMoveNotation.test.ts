import { describe, expect, it } from 'vitest'
import { createVsLocalGame, finishVsTurn, getVsHistoryPosition, goToVsHistory, selectVsCell, toggleVsMoveDirection, type VsCorner, type VsLocalGameState, type VsMoveDirection } from './vsLocalGame'
import { getVsMoveNotations } from './vsMoveNotation'

function play(game: VsLocalGameState, column: number, row: number, corner: VsCorner, direction: VsMoveDirection = 'orthogonal') {
  let draft = selectVsCell(game, column, row)
  for (let turn = 0; turn < (corner + 3) % 4; turn += 1) draft = selectVsCell(draft, column, row)
  if (draft.pendingMoveDirection !== direction) draft = toggleVsMoveDirection(draft)
  return finishVsTurn(draft)
}

function captureSquare() {
  let game = createVsLocalGame(() => 0)
  game = play(game, 0, 0, 0)
  game = play(game, 1, 0, 1)
  game = play(game, 1, 1, 2)
  return play(game, 0, 1, 3, 'diagonal')
}

describe('Local VS move notation', () => {
  it.each([
    [1, 'A'], [2, 'B'], [3, 'C'], [0, 'D'],
  ] as const)('maps internal corner %s to %s for both players and directions', (corner, letter) => {
    for (const player of [0, 1]) {
      for (const direction of ['orthogonal', 'diagonal'] as const) {
        const game = play(createVsLocalGame(() => player), 5, 8, corner, direction)
        expect(getVsMoveNotations(game.history.positions)).toEqual([{
          historyIndex: 1, moveNumber: 1, player,
          notation: `F8${letter}${direction === 'orthogonal' ? '+' : 'x'}`,
        }])
      }
    }
  })

  it('uses fixed A0–J9 coordinates regardless of the viewing player', () => {
    let game = play(createVsLocalGame(() => 1), 0, 0, 1, 'diagonal')
    game = play(game, 9, 9, 0)
    expect(getVsMoveNotations(game.history.positions).map((move) => move.notation)).toEqual(['A0Ax', 'J9D+'])
  })

  it('includes newly locked cells in row-then-column order, including the placed cell', () => {
    const game = captureSquare()
    const before = structuredClone(game.history.positions)
    expect(getVsMoveNotations(game.history.positions).map((move) => move.notation)).toEqual([
      'A0D+', 'B0A+', 'B1B+', 'A1CxA0B0A1B1',
    ])
    expect(game.history.positions).toEqual(before)
    const continued = play(game, 2, 3, 1)
    expect(getVsMoveNotations(continued.history.positions).at(-1)?.notation).toBe('C3A+')
  })

  it('lists shared cells once when multiple shapes lock, without shape names or counts', () => {
    const game = createVsLocalGame(() => 0)
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      for (const corner of [1, 2, 3] as const) {
        game.placedCornerominoes.push({ column: dx * corner, row: dy * corner, corner, player: 1 })
      }
    }
    const finished = play(game, 0, 0, 0)
    expect(finished.lockedCornerominoes).toHaveLength(2)
    expect(getVsMoveNotations(finished.history.positions)[0].notation).toBe('A0D+A0B0C0D0A1A2A3')
  })

  it('keeps the full move list while browsing or drafting, then replaces it on confirmation', () => {
    const latest = captureSquare()
    const original = getVsMoveNotations(latest.history.positions)
    const past = goToVsHistory(latest, 2)
    const draft = selectVsCell(past, 1, 4)
    expect(getVsMoveNotations(draft.history.positions)).toEqual(original)
    const branch = finishVsTurn(draft)
    expect(getVsMoveNotations(branch.history.positions).map((move) => move.notation)).toEqual(['A0D+', 'B0A+', 'B4A+'])
    expect(getVsMoveNotations(latest.history.positions)).toEqual(original)
  })

  it('reconstructs notation from saved history and does not invent earlier moves for legacy saves', () => {
    const latest = captureSquare()
    expect(getVsMoveNotations(structuredClone(latest.history.positions))).toEqual(getVsMoveNotations(latest.history.positions))
    const migrated = { ...latest, history: { positions: [getVsHistoryPosition(latest)], index: 0 } }
    expect(getVsMoveNotations(migrated.history.positions)).toEqual([])
    const continued = play(migrated, 2, 3, 1)
    expect(getVsMoveNotations(continued.history.positions)).toEqual([{
      historyIndex: 1, moveNumber: 5, notation: 'C3A+', player: 0,
    }])
  })

  it('does not record pending placements as moves', () => {
    const draft = selectVsCell(createVsLocalGame(), 4, 5)
    expect(getVsMoveNotations(draft.history.positions)).toEqual([])
  })
})
