import { describe, expect, it } from 'vitest'
import { createVsLocalGame, finishVsTurn, findValidatedVsCellKeys, getVsNextTurnPreviewCells, getVsTargetedCells, selectVsCell, toggleVsMoveDirection, type VsPlacedCorneromino } from './vsLocalGame'

describe('local VS game', () => {
  it('randomly picks a starting player', () => {
    expect(createVsLocalGame(() => 0).activePlayer).toBe(0)
    expect(createVsLocalGame(() => 0.9).activePlayer).toBe(1)
  })

  it('places top-right and rotates clockwise on repeated presses', () => {
    let game = createVsLocalGame(() => 0)
    game = selectVsCell(game, 3, 4)
    expect(game.pendingPlacement).toEqual({ column: 3, row: 4, corner: 1 })
    game = selectVsCell(game, 3, 4)
    expect(game.pendingPlacement?.corner).toBe(2)
    game = selectVsCell(game, 3, 4)
    expect(game.pendingPlacement?.corner).toBe(3)
    game = selectVsCell(game, 3, 4)
    expect(game.pendingPlacement?.corner).toBe(0)
    game = selectVsCell(game, 3, 4)
    expect(game.pendingPlacement?.corner).toBe(1)
  })

  it('moves an unconfirmed corner to another selected cell', () => {
    let game = selectVsCell(createVsLocalGame(() => 0), 3, 4)
    game = selectVsCell(game, 5, 6)
    expect(game.pendingPlacement).toEqual({ column: 5, row: 6, corner: 1 })
  })

  it('locks the pending corner and passes the turn', () => {
    let game = selectVsCell(createVsLocalGame(() => 0), 3, 4)
    game = finishVsTurn(game)
    expect(game.activePlayer).toBe(1)
    expect(game.pendingPlacement).toBeNull()
    expect(game.placedCornerominoes).toEqual([{ column: 3, row: 4, corner: 1, player: 0 }])
    expect(selectVsCell(game, 3, 4)).toBe(game)
  })

  it('locks every newly completed corneromino shape for the player ending the turn', () => {
    const pieces: VsPlacedCorneromino[] = [
      { column: 0, row: 0, corner: 0, player: 1 },
      { column: 1, row: 0, corner: 1, player: 1 },
      { column: 0, row: 1, corner: 3, player: 1 },
    ]
    const latest = { column: 1, row: 1, corner: 2, player: 0 } as const
    expect(findValidatedVsCellKeys([...pieces, latest], latest, [])).toEqual(['0,0', '1,0', '0,1', '1,1'])

    const game = finishVsTurn({ ...createVsLocalGame(() => 0), pendingPlacement: latest, placedCornerominoes: pieces })
    expect(game.placedCornerominoes.every((placement) => placement.lockedBy === 0)).toBe(true)
    expect(game.lockedCornerominoes).toHaveLength(1)
    expect(game.result).toBeNull()
  })

  it('does not validate a shape whose corners are not all different', () => {
    const pieces: VsPlacedCorneromino[] = [
      { column: 0, row: 0, corner: 1, player: 0 },
      { column: 1, row: 0, corner: 1, player: 0 },
      { column: 0, row: 1, corner: 3, player: 0 },
    ]
    const latest = { column: 1, row: 1, corner: 2, player: 1 } as const
    expect(findValidatedVsCellKeys([...pieces, latest], latest, [])).toEqual([])
  })

  it('locks the union when one placement completes multiple shapes', () => {
    const pieces: VsPlacedCorneromino[] = [
      { column: 0, row: 0, corner: 0, player: 0 },
      { column: 1, row: 0, corner: 1, player: 0 },
      { column: 0, row: 1, corner: 2, player: 0 },
      { column: 2, row: 1, corner: 1, player: 1 },
      { column: 1, row: 2, corner: 2, player: 1 },
      { column: 2, row: 2, corner: 0, player: 1 },
    ]
    const latest = { column: 1, row: 1, corner: 3, player: 1 } as const
    const game = finishVsTurn({ ...createVsLocalGame(() => 0.9), pendingPlacement: latest, placedCornerominoes: pieces })

    expect(game.placedCornerominoes).toHaveLength(7)
    expect(game.placedCornerominoes.every((placement) => placement.lockedBy === 1)).toBe(true)
    expect(game.lockedCornerominoes).toHaveLength(2)
  })

  it.each([false, true])('chooses the highest-scoring compatible shapes instead of the first match (diagonal: %s)', (includeDiagonal) => {
    // The first matching horizontal I consumes cells from both L shapes.
    // Choosing the two L shapes instead locks seven cells, not four.
    const pieces: VsPlacedCorneromino[] = [
      { column: 2, row: 3, corner: 1, player: 0 },
      { column: 4, row: 3, corner: 2, player: 1 },
      { column: 5, row: 3, corner: 3, player: 0 },
      { column: 2, row: 2, corner: 2, player: 1 },
      { column: 2, row: 1, corner: 3, player: 0 },
      { column: 4, row: 4, corner: 1, player: 1 },
      { column: 4, row: 5, corner: 3, player: 0 },
    ]
    if (includeDiagonal) {
      pieces.push(
        { column: 2, row: 4, corner: 1, player: 0 },
        { column: 1, row: 5, corner: 2, player: 1 },
        { column: 0, row: 6, corner: 3, player: 0 },
      )
    }
    const latest = { column: 3, row: 3, corner: 0 } as const
    const game = finishVsTurn({ ...createVsLocalGame(() => 0.9), pendingPlacement: latest, placedCornerominoes: pieces })
    const expectedShapeCount = includeDiagonal ? 3 : 2

    expect(game.lockedCornerominoes).toHaveLength(expectedShapeCount)
    expect(game.placedCornerominoes.filter((piece) => piece.lockedBy === 1)).toHaveLength(1 + 3 * expectedShapeCount)
    expect(game.placedCornerominoes.filter((piece) => piece.lockedBy === 0)).toHaveLength(0)
    expect(game.activePlayer).toBe(1)
    expect(game.result).toEqual({ reason: 'combination', winner: 1, shapeCount: expectedShapeCount })
    expect(game.pendingPlacement).toBeNull()

    const usedCells = new Set<string>()
    for (const shape of game.lockedCornerominoes) {
      expect(shape.player).toBe(1)
      expect(shape.cellKeys).toHaveLength(4)
      expect(shape.cellKeys).toContain('3,3')
      for (const key of shape.cellKeys) {
        if (key === '3,3') continue
        expect(usedCells.has(key)).toBe(false)
        usedCells.add(key)
      }
    }
    // Turn resolution must not change the board snapshot supplied by React.
    expect(pieces.every((piece) => piece.lockedBy === undefined)).toBe(true)
  })

  it('does not lock overlapping shapes that share more than the latest cell', () => {
    const pieces: VsPlacedCorneromino[] = [
      { column: 0, row: 0, corner: 0, player: 0 },
      { column: 1, row: 0, corner: 1, player: 0 },
      { column: 0, row: 1, corner: 3, player: 0 },
      { column: 2, row: 0, corner: 0, player: 1 },
      { column: 2, row: 1, corner: 3, player: 1 },
    ]
    const latest = { column: 1, row: 1, corner: 2, player: 1 } as const
    const game = finishVsTurn({ ...createVsLocalGame(() => 0.9), pendingPlacement: latest, placedCornerominoes: pieces })

    expect(game.placedCornerominoes.filter((placement) => placement.lockedBy === 1)).toHaveLength(4)
    expect(game.result).toBeNull()
  })

  it('restricts the next player to the selected orthogonal or diagonal lines', () => {
    let game = createVsLocalGame(() => 0)
    game = selectVsCell(game, 4, 4)
    game = finishVsTurn(game)
    expect(game.nextMoveConstraint).toEqual({ direction: 'orthogonal', originColumn: 4, originRow: 4 })
    expect(getVsTargetedCells(game)).toContainEqual({ column: 4, row: 0 })
    expect(getVsTargetedCells(game)).toContainEqual({ column: 0, row: 4 })
    expect(getVsTargetedCells(game)).not.toContainEqual({ column: 3, row: 3 })
    expect(selectVsCell(game, 3, 3)).toBe(game)

    game = selectVsCell(game, 4, 2)
    game = toggleVsMoveDirection(game)
    expect(game.pendingMoveDirection).toBe('diagonal')
    game = finishVsTurn(game)
    expect(game.nextMoveConstraint).toEqual({ direction: 'diagonal', originColumn: 4, originRow: 2 })
    expect(getVsTargetedCells(game)).toContainEqual({ column: 2, row: 0 })
    expect(getVsTargetedCells(game)).toContainEqual({ column: 6, row: 4 })
    expect(getVsTargetedCells(game)).not.toContainEqual({ column: 4, row: 0 })
    expect(selectVsCell(game, 4, 0)).toBe(game)
  })

  it('previews the current player’s selected next-turn direction', () => {
    let game = selectVsCell(createVsLocalGame(() => 0), 4, 4)
    expect(getVsNextTurnPreviewCells(game)).toContainEqual({ column: 4, row: 0 })
    expect(getVsNextTurnPreviewCells(game)).toContainEqual({ column: 0, row: 4 })
    expect(getVsNextTurnPreviewCells(game)).not.toContainEqual({ column: 3, row: 3 })

    game = toggleVsMoveDirection(game)
    expect(getVsNextTurnPreviewCells(game)).toContainEqual({ column: 0, row: 0 })
    expect(getVsNextTurnPreviewCells(game)).toContainEqual({ column: 8, row: 8 })
    expect(getVsNextTurnPreviewCells(game)).not.toContainEqual({ column: 4, row: 0 })
  })

  it('resolves eight compatible straight and diagonal shapes with one shared cell', () => {
    const pieces: VsPlacedCorneromino[] = []
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      for (const corner of [1, 2, 3] as const) {
        pieces.push({ column: 4 + dx * corner, row: 4 + dy * corner, corner, player: 1 })
      }
    }
    const game = finishVsTurn({
      ...createVsLocalGame(() => 0),
      placedCornerominoes: pieces,
      pendingPlacement: { column: 4, row: 4, corner: 0 },
    })

    expect(game.lockedCornerominoes).toHaveLength(8)
    expect(game.placedCornerominoes.filter((piece) => piece.lockedBy === 0)).toHaveLength(25)
  })

  it('preserves existing locks and excludes their cells from new shapes', () => {
    const previousGame = finishVsTurn({
      ...createVsLocalGame(() => 0),
      placedCornerominoes: [
        { column: 0, row: 0, corner: 0, player: 1 },
        { column: 1, row: 0, corner: 1, player: 1 },
        { column: 0, row: 1, corner: 3, player: 1 },
      ],
      pendingPlacement: { column: 1, row: 1, corner: 2 },
    })
    // The second square would reuse two cells from the first player's lock.
    const game = finishVsTurn({
      ...previousGame,
      placedCornerominoes: [...previousGame.placedCornerominoes, { column: 2, row: 0, corner: 0, player: 0 }],
      pendingPlacement: { column: 2, row: 1, corner: 3 },
    })

    expect(game.lockedCornerominoes).toEqual(previousGame.lockedCornerominoes)
    expect(game.placedCornerominoes.filter((piece) => piece.lockedBy === 0)).toEqual(previousGame.placedCornerominoes)
    expect(game.placedCornerominoes.filter((piece) => piece.lockedBy === 1)).toHaveLength(0)
  })
})
