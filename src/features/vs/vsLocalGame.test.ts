import { describe, expect, it } from 'vitest'
import { canPlayVsTurn, createVsLocalGame, finishVsTurn, getVsPlayerScores, goToVsHistory, hasVsTurnDraft, previousVsMove, resumeVsLocalGame, selectVsCell, toggleVsMoveDirection, type VsLocalGameState, type VsPlacedNokomino, type VsPlayerId } from './vsLocalGame'

const square: VsPlacedNokomino[] = [
  { column: 0, row: 0, corner: 0, player: 1 },
  { column: 1, row: 0, corner: 1, player: 1 },
  { column: 0, row: 1, corner: 3, player: 1 },
]

function withSquare(): VsLocalGameState {
  return {
    ...createVsLocalGame(() => 0),
    placedNokominos: square,
    pendingPlacement: { column: 1, row: 1, corner: 2 },
  }
}

function withSharedCellCombination(player: VsPlayerId = 0): VsLocalGameState {
  let game = createVsLocalGame(() => player)
  for (const direction of [-1, 1]) {
    for (const corner of [1, 2, 3] as const) {
      game.placedNokominos.push({ column: 4 + direction * corner, row: 4, corner, player: player === 0 ? 1 : 0 })
    }
  }
  game = selectVsCell(game, 4, 4)
  for (let rotation = 0; rotation < 3; rotation += 1) game = selectVsCell(game, 4, 4)
  for (const cell of game.placedNokominos) game = selectVsCell(game, cell.column, cell.row)
  return game
}

describe('Local VS manual claims', () => {
  it('places top-right and rotates the pending corner on ordinary taps', () => {
    const initial = createVsLocalGame(() => 0)
    expect(initial).toMatchObject({ boardSize: 10, result: null })
    expect(canPlayVsTurn(initial)).toBe(true)
    let game = selectVsCell(initial, 3, 4)
    expect(game.pendingPlacement).toEqual({ column: 3, row: 4, corner: 1 })
    game = selectVsCell(game, 3, 4)
    expect(game.pendingPlacement?.corner).toBe(2)
  })

  it('creates a 9×9 match when requested', () => {
    expect(createVsLocalGame(() => 0, { boardSize: 9 })).toMatchObject({ boardSize: 9, result: null })
  })

  it('toggles direction when tapping outside the contained board in a canvas letterbox band', () => {
    let game = selectVsCell(createVsLocalGame(() => 0), 3, 4)
    game = selectVsCell(game, 3, -1)
    expect(game.pendingMoveDirection).toBe('diagonal')
    game = selectVsCell(game, 3, 10)
    expect(game.pendingMoveDirection).toBe('orthogonal')
  })

  it('selects any unlocked existing cell, even when it belongs to the opponent', () => {
    let game = withSquare()
    game = selectVsCell(game, 0, 0)
    expect(game.selectedCellKeys).toEqual(['0,0'])
    game = selectVsCell(game, 0, 0)
    expect(game.selectedCellKeys).toEqual([])
  })

  it('only rotates the pending cell when tapped, preserving the explicit selection', () => {
    let game = selectVsCell(withSquare(), 0, 0)
    for (const corner of [3, 0, 1, 2]) {
      game = selectVsCell(game, 1, 1)
      expect(game.pendingPlacement?.corner).toBe(corner)
      expect(game.selectedCellKeys).toEqual(['0,0'])
    }
  })

  it('cancels a current turn before returning to the previous confirmed move', () => {
    let game = finishVsTurn(selectVsCell(createVsLocalGame(() => 0), 4, 4))
    game = selectVsCell(game, 4, 2)
    game = toggleVsMoveDirection(game)
    expect(hasVsTurnDraft(game)).toBe(true)
    const before = structuredClone(game)

    const cancelled = previousVsMove(game)
    expect(cancelled).toEqual({
      ...game.history.positions[game.history.index],
      ...game,
      ...game.history.positions[game.history.index],
      pendingMoveDirection: 'orthogonal',
      pendingPlacement: null,
      selectedCellKeys: [],
    })
    expect(cancelled.history.index).toBe(1)
    expect(hasVsTurnDraft(cancelled)).toBe(false)
    expect(game).toEqual(before)

    const previous = previousVsMove(cancelled)
    expect(previous.history.index).toBe(0)
    expect(previous.placedNokominos).toEqual([])
  })

  it('cancels selection-only drafts without changing the current confirmed move', () => {
    const base = finishVsTurn(selectVsCell(createVsLocalGame(() => 0), 3, 3))
    const selected = selectVsCell(base, 3, 3)
    expect(hasVsTurnDraft(selected)).toBe(true)
    const cancelled = previousVsMove(selected)
    expect(cancelled.history.index).toBe(1)
    expect(cancelled.placedNokominos).toEqual(base.placedNokominos)
    expect(previousVsMove(cancelled).history.index).toBe(0)
  })

  it('cancels a placement draft at the initial position instead of navigating', () => {
    const draft = selectVsCell(createVsLocalGame(() => 0), 3, 3)
    const cancelled = previousVsMove(draft)
    expect(cancelled.history.index).toBe(0)
    expect(cancelled.placedNokominos).toEqual([])
    expect(cancelled.pendingPlacement).toBeNull()
  })

  it('does not lock an unselected valid Nokomino', () => {
    const game = finishVsTurn(withSquare())
    expect(game.lockedNokominos).toEqual([])
    expect(game.placedNokominos).toHaveLength(4)
    expect(game.activePlayer).toBe(1)
  })

  it('includes the pending cell to complete a lock from three selected cells', () => {
    let game = withSquare()
    for (const [column, row] of [[0, 0], [1, 0], [0, 1]]) {
      game = selectVsCell(game, column, row)
    }
    const locked = finishVsTurn(game)
    expect(locked.lockedNokominos).toEqual([{ id: 'lock:1', player: 0, cellKeys: ['0,0', '1,0', '0,1', '1,1'] }])
    expect(locked.placedNokominos.every((placement) => placement.lockedBy === 0)).toBe(true)
    expect(locked.selectedCellKeys).toEqual([])
  })

  it('locks a complete selection elsewhere without including the pending cell', () => {
    let game = withSquare()
    game = { ...game, placedNokominos: [...square, { ...game.pendingPlacement!, player: 1 }], pendingPlacement: { column: 7, row: 7, corner: 0 } }
    for (const placement of game.placedNokominos) game = selectVsCell(game, placement.column, placement.row)
    const finished = finishVsTurn(game)
    expect(finished.lockedNokominos).toHaveLength(1)
    expect(getVsPlayerScores(finished.placedNokominos)).toEqual([4, 0])
    expect(finished.placedNokominos.at(-1)?.lockedBy).toBeUndefined()
  })

  it.each([false, true])('prefers the explicit combination when including the pending cell would also work (legacy selection: %s)', (legacySelection) => {
    const game = createVsLocalGame(() => 0)
    for (let column = 0; column < 7; column += 1) {
      game.placedNokominos.push({ column, row: 4, corner: (column % 4) as 0 | 1 | 2 | 3, player: 1 })
      game.selectedCellKeys.push(`${column},4`)
    }
    game.pendingPlacement = { column: 7, row: 4, corner: 3 }
    // Seven cells form two I shapes sharing a cell; all eight also form two separate I shapes.
    const allEight = finishVsTurn({
      ...game,
      placedNokominos: [...game.placedNokominos, { ...game.pendingPlacement, player: 1 }],
      pendingPlacement: { column: 9, row: 9, corner: 0 },
      selectedCellKeys: [...game.selectedCellKeys, '7,4'],
    })
    expect(getVsPlayerScores(allEight.placedNokominos)).toEqual([8, 0])

    if (legacySelection) game.selectedCellKeys.push('7,4')
    const finished = finishVsTurn(game)
    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
    expect(getVsPlayerScores(finished.placedNokominos)).toEqual([7, 0])
    expect(finished.placedNokominos.at(-1)?.lockedBy).toBeUndefined()
  })

  it('removes the old pending-cell selection when resuming a long-press-era draft', () => {
    const game = withSharedCellCombination()
    const saved = { ...game, selectedCellKeys: [...game.selectedCellKeys, '4,4'] }
    const before = structuredClone(saved)
    const resumed = resumeVsLocalGame(saved)
    expect(resumed).toEqual(game)
    expect(saved).toEqual(before)
    expect(finishVsTurn(resumed).result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
  })

  it('rejects incomplete and over-selected claims', () => {
    let incomplete = selectVsCell(withSquare(), 0, 0)
    incomplete = selectVsCell(incomplete, 1, 0)
    expect(finishVsTurn(incomplete).lockedNokominos).toEqual([])

    const overSelected = { ...withSquare(), selectedCellKeys: ['0,0', '1,0', '0,1', '1,1', '9,9'] }
    expect(finishVsTurn(overSelected).lockedNokominos).toEqual([])
  })

  it('wins by selecting the exact number of separate, non-overlapping shapes', () => {
    const game = createVsLocalGame(() => 0)
    game.pendingPlacement = { column: 9, row: 9, corner: 0 }
    game.placedNokominos = [
      ...square,
      { column: 1, row: 1, corner: 2, player: 1 },
      { column: 4, row: 0, corner: 0, player: 1 },
      { column: 5, row: 0, corner: 1, player: 1 },
      { column: 4, row: 1, corner: 3, player: 1 },
      { column: 5, row: 1, corner: 2, player: 1 },
    ]
    game.selectedCellKeys = ['0,0', '1,0', '0,1', '1,1', '4,0', '5,0', '4,1', '5,1']
    const finished = finishVsTurn(game)
    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
    expect(finished.lockedNokominos).toHaveLength(2)
    expect(finished.placedNokominos.filter((placement) => placement.lockedBy === 0)).toHaveLength(8)
  })

  it.each([0, 1] as const)('locks a selected double sharing the pending cell for player %s', (player) => {
    const game = withSharedCellCombination(player)
    const before = structuredClone(game)
    expect(game.selectedCellKeys).toHaveLength(6)
    const finished = finishVsTurn(game)

    expect(finished.result).toEqual({ reason: 'combination', winner: player, shapeCount: 2 })
    expect(finished.lockedNokominos.map((shape) => [...shape.cellKeys].sort().join('|')).sort()).toEqual([
      '1,4|2,4|3,4|4,4', '4,4|5,4|6,4|7,4',
    ])
    expect(getVsPlayerScores(finished.placedNokominos)[player]).toBe(7)
    expect(finished.captureStreak).toEqual({ player, turnCount: 1 })
    expect(finished.selectedCellKeys).toEqual([])
    expect(finished.pendingPlacement).toBeNull()
    expect(game).toEqual(before)
    expect(goToVsHistory(goToVsHistory(finished, 0), 1)).toEqual(finished)
    expect(finishVsTurn({ ...game, selectedCellKeys: [...game.selectedCellKeys].reverse() }).result).toEqual(finished.result)
  })

  it('claims a missed combination sharing an existing cell away from the new placement', () => {
    let game = withSharedCellCombination()
    game.placedNokominos.push({ ...game.pendingPlacement!, player: 1 })
    game.pendingPlacement = { column: 9, row: 9, corner: 0 }
    game = selectVsCell(game, 4, 4)
    const finished = finishVsTurn(game)

    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
    expect(getVsPlayerScores(finished.placedNokominos)).toEqual([7, 0])
    expect(finished.placedNokominos.at(-1)?.lockedBy).toBeUndefined()
  })

  it('requires exactly the configured shape count for shared-cell combinations', () => {
    const game = { ...withSharedCellCombination(), combinationWinCount: 3 }
    expect(finishVsTurn(game).lockedNokominos).toEqual([])
    for (const corner of [1, 2, 3] as const) {
      game.placedNokominos.push({ column: 4, row: 4 - corner, corner, player: 1 })
      game.selectedCellKeys.push(`4,${4 - corner}`)
    }
    const finished = finishVsTurn(game)
    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 3 })
    expect(finished.lockedNokominos).toHaveLength(3)
    expect(getVsPlayerScores(finished.placedNokominos)).toEqual([10, 0])
    expect(finishVsTurn({ ...game, combinationWinCount: 2 }).lockedNokominos).toEqual([])
  })

  it.each(['unselected', 'missing-cell', 'extra-cell', 'invalid-corners', 'locked-cell'] as const)('rejects a %s shared-cell claim without partially locking it', (invalid) => {
    let game = withSharedCellCombination()
    if (invalid === 'unselected') game.selectedCellKeys = []
    if (invalid === 'missing-cell') game = selectVsCell(game, 3, 4)
    if (invalid === 'extra-cell') {
      game.placedNokominos.push({ column: 9, row: 0, corner: 0, player: 1 })
      game = selectVsCell(game, 9, 0)
    }
    if (invalid === 'invalid-corners') game = selectVsCell(game, 4, 4)
    if (invalid === 'locked-cell') game.placedNokominos[0].lockedBy = 1
    const finished = finishVsTurn(game)
    expect(finished.result).toBeNull()
    expect(finished.lockedNokominos).toEqual([])
    expect(getVsPlayerScores(finished.placedNokominos)[0]).toBe(0)
  })

  it.each([false, true])('rejects shapes sharing two cells, including with legacy overlap option %s', (allowOverlappingCombinationWin) => {
    const game = { ...withSquare(), allowOverlappingCombinationWin }
    game.placedNokominos = [...game.placedNokominos,
      { column: 2, row: 0, corner: 0, player: 1 },
      { column: 2, row: 1, corner: 3, player: 1 },
    ]
    game.selectedCellKeys = ['0,0', '1,0', '0,1', '1,1', '2,0', '2,1']
    const finished = finishVsTurn(game)
    expect(finished.result).toBeNull()
    expect(finished.lockedNokominos).toEqual([])
  })
})
