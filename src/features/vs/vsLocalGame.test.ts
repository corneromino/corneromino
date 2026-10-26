import { describe, expect, it } from 'vitest'
import { canPlayVsTurn, createVsLocalGame, finishVsTurn, getVsPlayerScores, goToVsHistory, resumeVsLocalGame, selectVsCell, type VsLocalGameState, type VsPlacedCorneromino, type VsPlayerId } from './vsLocalGame'

const square: VsPlacedCorneromino[] = [
  { column: 0, row: 0, corner: 0, player: 1 },
  { column: 1, row: 0, corner: 1, player: 1 },
  { column: 0, row: 1, corner: 3, player: 1 },
]

function withSquare(): VsLocalGameState {
  return {
    ...createVsLocalGame(() => 0),
    placedCornerominoes: square,
    pendingPlacement: { column: 1, row: 1, corner: 2 },
  }
}

function withSharedCellCombination(player: VsPlayerId = 0): VsLocalGameState {
  let game = createVsLocalGame(() => player)
  for (const direction of [-1, 1]) {
    for (const corner of [1, 2, 3] as const) {
      game.placedCornerominoes.push({ column: 4 + direction * corner, row: 4, corner, player: player === 0 ? 1 : 0 })
    }
  }
  game = selectVsCell(game, 4, 4)
  for (let rotation = 0; rotation < 3; rotation += 1) game = selectVsCell(game, 4, 4)
  for (const cell of game.placedCornerominoes) game = selectVsCell(game, cell.column, cell.row)
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

  it('does not lock an unselected valid Corneromino', () => {
    const game = finishVsTurn(withSquare())
    expect(game.lockedCornerominoes).toEqual([])
    expect(game.placedCornerominoes).toHaveLength(4)
    expect(game.activePlayer).toBe(1)
  })

  it('includes the pending cell to complete a lock from three selected cells', () => {
    let game = withSquare()
    for (const [column, row] of [[0, 0], [1, 0], [0, 1]]) {
      game = selectVsCell(game, column, row)
    }
    const locked = finishVsTurn(game)
    expect(locked.lockedCornerominoes).toEqual([{ id: 'lock:1', player: 0, cellKeys: ['0,0', '1,0', '0,1', '1,1'] }])
    expect(locked.placedCornerominoes.every((placement) => placement.lockedBy === 0)).toBe(true)
    expect(locked.selectedCellKeys).toEqual([])
  })

  it('locks a complete selection elsewhere without including the pending cell', () => {
    let game = withSquare()
    game = { ...game, placedCornerominoes: [...square, { ...game.pendingPlacement!, player: 1 }], pendingPlacement: { column: 7, row: 7, corner: 0 } }
    for (const placement of game.placedCornerominoes) game = selectVsCell(game, placement.column, placement.row)
    const finished = finishVsTurn(game)
    expect(finished.lockedCornerominoes).toHaveLength(1)
    expect(getVsPlayerScores(finished.placedCornerominoes)).toEqual([4, 0])
    expect(finished.placedCornerominoes.at(-1)?.lockedBy).toBeUndefined()
  })

  it.each([false, true])('prefers the explicit combination when including the pending cell would also work (legacy selection: %s)', (legacySelection) => {
    const game = createVsLocalGame(() => 0)
    for (let column = 0; column < 7; column += 1) {
      game.placedCornerominoes.push({ column, row: 4, corner: (column % 4) as 0 | 1 | 2 | 3, player: 1 })
      game.selectedCellKeys.push(`${column},4`)
    }
    game.pendingPlacement = { column: 7, row: 4, corner: 3 }
    // Seven cells form two I shapes sharing a cell; all eight also form two separate I shapes.
    const allEight = finishVsTurn({
      ...game,
      placedCornerominoes: [...game.placedCornerominoes, { ...game.pendingPlacement, player: 1 }],
      pendingPlacement: { column: 9, row: 9, corner: 0 },
      selectedCellKeys: [...game.selectedCellKeys, '7,4'],
    })
    expect(getVsPlayerScores(allEight.placedCornerominoes)).toEqual([8, 0])

    if (legacySelection) game.selectedCellKeys.push('7,4')
    const finished = finishVsTurn(game)
    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
    expect(getVsPlayerScores(finished.placedCornerominoes)).toEqual([7, 0])
    expect(finished.placedCornerominoes.at(-1)?.lockedBy).toBeUndefined()
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
    expect(finishVsTurn(incomplete).lockedCornerominoes).toEqual([])

    const overSelected = { ...withSquare(), selectedCellKeys: ['0,0', '1,0', '0,1', '1,1', '9,9'] }
    expect(finishVsTurn(overSelected).lockedCornerominoes).toEqual([])
  })

  it('wins by selecting the exact number of separate, non-overlapping shapes', () => {
    const game = createVsLocalGame(() => 0)
    game.pendingPlacement = { column: 9, row: 9, corner: 0 }
    game.placedCornerominoes = [
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
    expect(finished.lockedCornerominoes).toHaveLength(2)
    expect(finished.placedCornerominoes.filter((placement) => placement.lockedBy === 0)).toHaveLength(8)
  })

  it.each([0, 1] as const)('locks a selected double sharing the pending cell for player %s', (player) => {
    const game = withSharedCellCombination(player)
    const before = structuredClone(game)
    expect(game.selectedCellKeys).toHaveLength(6)
    const finished = finishVsTurn(game)

    expect(finished.result).toEqual({ reason: 'combination', winner: player, shapeCount: 2 })
    expect(finished.lockedCornerominoes.map((shape) => [...shape.cellKeys].sort().join('|')).sort()).toEqual([
      '1,4|2,4|3,4|4,4', '4,4|5,4|6,4|7,4',
    ])
    expect(getVsPlayerScores(finished.placedCornerominoes)[player]).toBe(7)
    expect(finished.captureStreak).toEqual({ player, turnCount: 1 })
    expect(finished.selectedCellKeys).toEqual([])
    expect(finished.pendingPlacement).toBeNull()
    expect(game).toEqual(before)
    expect(goToVsHistory(goToVsHistory(finished, 0), 1)).toEqual(finished)
    expect(finishVsTurn({ ...game, selectedCellKeys: [...game.selectedCellKeys].reverse() }).result).toEqual(finished.result)
  })

  it('claims a missed combination sharing an existing cell away from the new placement', () => {
    let game = withSharedCellCombination()
    game.placedCornerominoes.push({ ...game.pendingPlacement!, player: 1 })
    game.pendingPlacement = { column: 9, row: 9, corner: 0 }
    game = selectVsCell(game, 4, 4)
    const finished = finishVsTurn(game)

    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
    expect(getVsPlayerScores(finished.placedCornerominoes)).toEqual([7, 0])
    expect(finished.placedCornerominoes.at(-1)?.lockedBy).toBeUndefined()
  })

  it('requires exactly the configured shape count for shared-cell combinations', () => {
    const game = { ...withSharedCellCombination(), combinationWinCount: 3 }
    expect(finishVsTurn(game).lockedCornerominoes).toEqual([])
    for (const corner of [1, 2, 3] as const) {
      game.placedCornerominoes.push({ column: 4, row: 4 - corner, corner, player: 1 })
      game.selectedCellKeys.push(`4,${4 - corner}`)
    }
    const finished = finishVsTurn(game)
    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 3 })
    expect(finished.lockedCornerominoes).toHaveLength(3)
    expect(getVsPlayerScores(finished.placedCornerominoes)).toEqual([10, 0])
    expect(finishVsTurn({ ...game, combinationWinCount: 2 }).lockedCornerominoes).toEqual([])
  })

  it.each(['unselected', 'missing-cell', 'extra-cell', 'invalid-corners', 'locked-cell'] as const)('rejects a %s shared-cell claim without partially locking it', (invalid) => {
    let game = withSharedCellCombination()
    if (invalid === 'unselected') game.selectedCellKeys = []
    if (invalid === 'missing-cell') game = selectVsCell(game, 3, 4)
    if (invalid === 'extra-cell') {
      game.placedCornerominoes.push({ column: 9, row: 0, corner: 0, player: 1 })
      game = selectVsCell(game, 9, 0)
    }
    if (invalid === 'invalid-corners') game = selectVsCell(game, 4, 4)
    if (invalid === 'locked-cell') game.placedCornerominoes[0].lockedBy = 1
    const finished = finishVsTurn(game)
    expect(finished.result).toBeNull()
    expect(finished.lockedCornerominoes).toEqual([])
    expect(getVsPlayerScores(finished.placedCornerominoes)[0]).toBe(0)
  })

  it.each([false, true])('rejects shapes sharing two cells, including with legacy overlap option %s', (allowOverlappingCombinationWin) => {
    const game = { ...withSquare(), allowOverlappingCombinationWin }
    game.placedCornerominoes = [...game.placedCornerominoes,
      { column: 2, row: 0, corner: 0, player: 1 },
      { column: 2, row: 1, corner: 3, player: 1 },
    ]
    game.selectedCellKeys = ['0,0', '1,0', '0,1', '1,1', '2,0', '2,1']
    const finished = finishVsTurn(game)
    expect(finished.result).toBeNull()
    expect(finished.lockedCornerominoes).toEqual([])
  })
})
