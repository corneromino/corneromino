import { describe, expect, it } from 'vitest'
import { advanceCascadeGame, createCascadeGame, dropCascadePiece, getCascadeLandingRow, isValidCascadeLockSelection, moveCascadePiece, resolveCascadeLockedRows, type CascadeGameState } from './cascadeGame'

describe('Cascade game', () => {
  const gridSize = { columns: 2, rows: 3 }

  it('spawns a random corneromino at the top of the grid', () => {
    const nextState = advanceCascadeGame(createCascadeGame(), gridSize, () => 0.6)

    expect(nextState.activePiece).toEqual({ column: 1, corner: 2, row: 0 })
  })

  it('spawns corners in the configured sequential order', () => {
    const state = advanceCascadeGame(createCascadeGame(), gridSize, () => 0.5, 'sequential')

    expect(state.activePiece?.corner).toBe(0)
    expect(state.upcomingCorners).toEqual([3, 2, 1])
  })

  it('moves the active corneromino down one cell', () => {
    const nextState = advanceCascadeGame({ activePiece: { column: 0, corner: 1, row: 0 }, settledPieces: [] }, gridSize)

    expect(nextState.activePiece).toEqual({ column: 0, corner: 1, row: 1 })
  })

  it('stacks a corneromino when it reaches the floor or another piece', () => {
    const onFloor = advanceCascadeGame({ activePiece: { column: 0, corner: 1, row: 2 }, settledPieces: [] }, gridSize)
    const onPiece = advanceCascadeGame({
      activePiece: { column: 1, corner: 0, row: 0 },
      settledPieces: [{ column: 1, corner: 2, row: 1 }],
    }, gridSize)

    expect(onFloor).toEqual({ activePiece: null, settledPieces: [{ column: 0, corner: 1, row: 2 }] })
    expect(onPiece).toEqual({
      activePiece: null,
      settledPieces: [{ column: 1, corner: 2, row: 1 }, { column: 1, corner: 0, row: 0 }],
    })
  })

  it('moves the active corneromino horizontally without crossing board edges or settled pieces', () => {
    const state: CascadeGameState = {
      activePiece: { column: 1, corner: 0 as const, row: 1 },
      settledPieces: [{ column: 0, corner: 2 as const, row: 1 }],
    }

    expect(moveCascadePiece(state, gridSize, 1).activePiece?.column).toBe(1)
    expect(moveCascadePiece(state, gridSize, -1).activePiece?.column).toBe(1)
    expect(moveCascadePiece({ ...state, settledPieces: [] }, gridSize, -1).activePiece?.column).toBe(0)
  })

  it('hard drops the active corneromino onto the floor or a settled piece', () => {
    const onFloor = dropCascadePiece({ activePiece: { column: 0, corner: 1, row: 0 }, settledPieces: [] }, gridSize)
    const onPiece = dropCascadePiece({
      activePiece: { column: 1, corner: 0, row: 0 },
      settledPieces: [{ column: 1, corner: 2, row: 2 }],
    }, gridSize)

    expect(onFloor.settledPieces).toEqual([{ column: 0, corner: 1, row: 2 }])
    expect(onPiece.settledPieces.at(-1)).toEqual({ column: 1, corner: 0, row: 1 })
  })

  it('keeps upcoming corners while no corneromino is falling', () => {
    const state: CascadeGameState = {
      activePiece: { column: 0, corner: 1 as const, row: 2 },
      nextCornerIndex: 4,
      settledPieces: [],
      upcomingCorners: [0, 3, 2],
    }

    expect(advanceCascadeGame(state, gridSize).upcomingCorners).toEqual([0, 3, 2])
    expect(dropCascadePiece(state, gridSize).upcomingCorners).toEqual([0, 3, 2])
  })

  it('finds the lowest open landing cell for the active corneromino', () => {
    expect(getCascadeLandingRow({ activePiece: { column: 0, corner: 1, row: 0 }, settledPieces: [] }, gridSize)).toBe(2)
    expect(getCascadeLandingRow({
      activePiece: { column: 0, corner: 1, row: 0 },
      settledPieces: [{ column: 0, corner: 2, row: 2 }],
    }, gridSize)).toBe(1)
  })

  it('clears full locked rows while gravity moves only unlocked pieces', () => {
    const resolution = resolveCascadeLockedRows({
      activePiece: null,
      settledPieces: [
        { column: 0, corner: 0, row: 0 },
        { column: 0, corner: 1, row: 1 },
        { column: 1, corner: 2, row: 1 },
      ],
    }, { columns: 2, rows: 3 }, [{ cellKey: '0,1', groupId: 'group' }, { cellKey: '1,1', groupId: 'group' }])

    expect(resolution.clearedCellKeys).toEqual(['0,1', '1,1'])
    expect(resolution.state.settledPieces).toEqual([{ column: 0, corner: 0, row: 2 }])
    expect(resolution.gravityMoves).toEqual([{ fromCellKey: '0,0', toCellKey: '0,2' }])
  })

  it('keeps every cell of a locked group together when one cell is blocked', () => {
    const resolution = resolveCascadeLockedRows({
      activePiece: null,
      settledPieces: [
        { column: 0, corner: 0, row: 0 },
        { column: 1, corner: 1, row: 0 },
        { column: 0, corner: 2, row: 2 },
        { column: 0, corner: 3, row: 3 },
        { column: 1, corner: 0, row: 3 },
        { column: 2, corner: 1, row: 3 },
      ],
    }, { columns: 3, rows: 4 }, [
      { cellKey: '0,0', groupId: 'top' },
      { cellKey: '1,0', groupId: 'top' },
      { cellKey: '0,2', groupId: 'blocker' },
      { cellKey: '0,3', groupId: 'clear' },
      { cellKey: '1,3', groupId: 'clear' },
      { cellKey: '2,3', groupId: 'clear' },
    ])

    expect(resolution.state.settledPieces).toEqual(expect.arrayContaining([
      { column: 0, corner: 0, row: 2 },
      { column: 1, corner: 1, row: 2 },
      { column: 0, corner: 2, row: 3 },
    ]))
  })

  it('splits disconnected locked remnants into independent falling bodies', () => {
    const resolution = resolveCascadeLockedRows({
      activePiece: null,
      settledPieces: [
        { column: 0, corner: 0, row: 1 },
        { column: 0, corner: 1, row: 2 },
        { column: 1, corner: 2, row: 2 },
        { column: 0, corner: 3, row: 3 },
      ],
    }, { columns: 2, rows: 4 }, [
      { cellKey: '0,1', groupId: 'split-group' },
      { cellKey: '0,2', groupId: 'clear' },
      { cellKey: '1,2', groupId: 'clear' },
      { cellKey: '0,3', groupId: 'split-group' },
    ])

    expect(resolution.state.settledPieces).toEqual(expect.arrayContaining([
      { column: 0, corner: 0, row: 2 },
      { column: 0, corner: 3, row: 3 },
    ]))
    expect(resolution.lockedCells).toEqual(expect.arrayContaining([
      { cellKey: '0,1', groupId: 'split-group:fragment:1' },
      { cellKey: '0,3', groupId: 'split-group:fragment:2' },
    ]))
  })

  it('only accepts a tetromino with four unique corners as a lock selection', () => {
    expect(isValidCascadeLockSelection([
      { column: 0, corner: 0, row: 0 },
      { column: 1, corner: 1, row: 0 },
      { column: 0, corner: 2, row: 1 },
      { column: 1, corner: 3, row: 1 },
    ])).toBe(true)
    expect(isValidCascadeLockSelection([
      { column: 0, corner: 0, row: 0 },
      { column: 1, corner: 0, row: 0 },
      { column: 0, corner: 2, row: 1 },
      { column: 1, corner: 3, row: 1 },
    ])).toBe(false)
  })
})
