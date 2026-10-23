import { describe, expect, it } from 'vitest'
import { createTetrominoCells, TETROMINOES, TETROMINO_KINDS, type TetrominoKind } from '@/game/tetrominoes'
import { createVsLocalGame, finishVsTurn, type VsCorner, type VsLocalGameState, type VsLockedCorneromino, type VsPlacedCorneromino, type VsPlayerId } from './vsLocalGame'

type Position = readonly [column: number, row: number]

function shapeCells(kind: TetrominoKind, column: number, row: number, rotation = 0): Position[] {
  return createTetrominoCells(kind, rotation).map((cell) => [cell.x + column, cell.y + row])
}

function lockedShape(id: string, kind: TetrominoKind, column: number, row: number, player: VsPlayerId = 0): VsLockedCorneromino {
  return { id, player, cellKeys: shapeCells(kind, column, row).map(([x, y]) => `${x},${y}`) }
}

function gameBeforeLock(cells: readonly Position[], locks: VsLockedCorneromino[], player: VsPlayerId = 0): VsLocalGameState {
  const placed = new Map<string, VsPlacedCorneromino>()
  for (const lock of locks) {
    for (const [index, key] of lock.cellKeys.entries()) {
      const [column, row] = key.split(',').map(Number)
      placed.set(key, { column, row, corner: index as VsCorner, player: lock.player, lockedBy: lock.player })
    }
  }
  for (const [index, [column, row]] of cells.slice(0, -1).entries()) {
    // Placement ownership does not affect who captures a newly completed shape.
    placed.set(`${column},${row}`, { column, row, corner: index as VsCorner, player: player === 0 ? 1 : 0 })
  }
  const [column, row] = cells.at(-1)!
  return {
    ...createVsLocalGame(() => player === 0 ? 0 : 0.9),
    placedCornerominoes: [...placed.values()],
    lockedCornerominoes: locks,
    pendingPlacement: { column, row, corner: 3 },
  }
}

describe('Local VS friendly shape restrictions', () => {
  it.each(TETROMINO_KINDS)('checks a new %s against an edge-adjacent friendly T', (kind) => {
    const previousLock = lockedShape('lock:1', 'T', 4, 2)
    const before = gameBeforeLock(shapeCells(kind, 4, 4), [previousLock])
    const after = finishVsTurn(before)
    const allowed = kind === 'T'

    expect(after.lockedCornerominoes).toHaveLength(allowed ? 2 : 1)
    expect(after.placedCornerominoes.filter((cell) => cell.lockedBy === 0)).toHaveLength(allowed ? 8 : 4)
    expect(after.placedCornerominoes).toHaveLength(8)
    expect(after.activePlayer).toBe(1)
    expect(after.pendingPlacement).toBeNull()
    expect(after.nextMoveConstraint).toMatchObject({ originColumn: before.pendingPlacement!.column, originRow: before.pendingPlacement!.row })
    expect(after.lockedCornerominoes[0]).toEqual(previousLock)
    // Historical locks never count towards a simultaneous combination victory.
    expect(after.result).toBeNull()
    expect(before.lockedCornerominoes).toHaveLength(1)
  })

  it.each(TETROMINO_KINDS)('allows rotated %s shapes beside their own kind', (kind) => {
    for (let rotation = 0; rotation < TETROMINOES[kind].rotations.length; rotation += 1) {
      const cells = shapeCells(kind, 4, 4, rotation)
      const topCell = cells.find(([, row]) => row === 4)!
      const original = createTetrominoCells(kind)
      const bottomRow = Math.max(...original.map((cell) => cell.y))
      const bottomCell = original.find((cell) => cell.y === bottomRow)!
      const previousLock = lockedShape('lock:1', kind, topCell[0] - bottomCell.x, 3 - bottomRow)
      const after = finishVsTurn(gameBeforeLock(cells, [previousLock]))

      expect(after.lockedCornerominoes).toHaveLength(2)
      expect(after.placedCornerominoes.filter((cell) => cell.lockedBy === 0)).toHaveLength(8)
    }
  })

  it.each([['L', 'J'], ['J', 'L'], ['S', 'Z'], ['Z', 'S']] as const)('keeps %s distinct from its mirror %s', (kind, mirror) => {
    const previousLock = lockedShape('lock:1', mirror, 4, kind === 'S' || kind === 'Z' ? 2 : 1)
    const after = finishVsTurn(gameBeforeLock(shapeCells(kind, 4, 4), [previousLock]))
    expect(after.lockedCornerominoes).toHaveLength(1)
  })

  it.each([0, 1] as const)('ignores opponent shapes for player %s', (player) => {
    const opponentLock = lockedShape('lock:1', 'T', 4, 2, player === 0 ? 1 : 0)
    const after = finishVsTurn(gameBeforeLock(shapeCells('L', 4, 4), [opponentLock], player))

    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(after.lockedCornerominoes[1]!.player).toBe(player)
    expect(after.placedCornerominoes.filter((cell) => cell.lockedBy === player)).toHaveLength(4)
  })

  it('ignores corner-only contact with a different friendly shape', () => {
    const after = finishVsTurn(gameBeforeLock(shapeCells('O', 4, 4), [lockedShape('lock:1', 'I', 6, 3)]))
    expect(after.lockedCornerominoes).toHaveLength(2)
  })

  it('allows any shape away from friendly locked shapes', () => {
    const after = finishVsTurn(gameBeforeLock(shapeCells('L', 6, 6), [lockedShape('lock:1', 'T', 0, 0)]))
    expect(after.lockedCornerominoes).toHaveLength(2)
  })

  it('allows a match even when another touching friendly shape differs', () => {
    const after = finishVsTurn(gameBeforeLock(shapeCells('T', 4, 4), [
      lockedShape('lock:1', 'O', 7, 4),
      lockedShape('lock:2', 'T', 1, 4),
    ]))
    expect(after.lockedCornerominoes).toHaveLength(3)
  })

  it('does not use an opponent match to satisfy a friendly mismatch', () => {
    const after = finishVsTurn(gameBeforeLock(shapeCells('T', 4, 4), [
      lockedShape('lock:1', 'O', 7, 4),
      lockedShape('lock:2', 'T', 1, 4, 1),
    ]))
    expect(after.lockedCornerominoes).toHaveLength(2)
  })

  it.each([false, true])('recognizes all shapes sharing a touching locked cell (reversed: %s)', (reverse) => {
    // Only 3,5 touches the new T. That cell belongs to both a T and an I.
    const locks = [
      lockedShape('lock:1', 'T', 1, 4),
      { id: 'lock:2', player: 0 as const, cellKeys: ['3,5', '3,6', '3,7', '3,8'] },
    ]
    const after = finishVsTurn(gameBeforeLock(shapeCells('T', 4, 4), reverse ? locks.reverse() : locks))
    expect(after.lockedCornerominoes).toHaveLength(3)
    expect(after.placedCornerominoes.filter((cell) => cell.lockedBy === 0)).toHaveLength(11)
  })

  it('allows different simultaneous shapes to share the newly placed cell', () => {
    const before: VsLocalGameState = {
      ...createVsLocalGame(() => 0),
      placedCornerominoes: [
        { column: 4, row: 3, corner: 1, player: 0 },
        { column: 5, row: 3, corner: 2, player: 0 },
        { column: 6, row: 3, corner: 3, player: 0 },
        { column: 3, row: 2, corner: 1, player: 0 },
        { column: 3, row: 1, corner: 2, player: 0 },
        { column: 2, row: 1, corner: 3, player: 0 },
      ],
      pendingPlacement: { column: 3, row: 3, corner: 0 },
    }
    const after = finishVsTurn(before)
    expect(after.lockedCornerominoes).toHaveLength(2)
    expect(after.placedCornerominoes.filter((cell) => cell.lockedBy === 0)).toHaveLength(7)
  })

  it('filters each overlapping candidate against previously locked friendly shapes', () => {
    const previousLock = lockedShape('lock:1', 'T', 5, 4)
    const before = gameBeforeLock([[3, 3]], [previousLock])
    before.pendingPlacement = { column: 3, row: 3, corner: 0 }
    before.placedCornerominoes.push(
      { column: 2, row: 3, corner: 1, player: 0 },
      { column: 4, row: 3, corner: 2, player: 1 },
      { column: 5, row: 3, corner: 3, player: 0 },
      { column: 2, row: 2, corner: 2, player: 1 },
      { column: 2, row: 1, corner: 3, player: 0 },
      { column: 4, row: 4, corner: 1, player: 1 },
      { column: 4, row: 5, corner: 3, player: 0 },
    )
    const after = finishVsTurn(before)

    // The right L is blocked by the old T. The left L, I, and new T share seven cells.
    expect(after.lockedCornerominoes).toHaveLength(4)
    expect(after.placedCornerominoes.filter((cell) => cell.lockedBy === 0)).toHaveLength(11)
    expect(after.placedCornerominoes.find((cell) => cell.column === 4 && cell.row === 5)!.lockedBy).toBeUndefined()
    expect(after.placedCornerominoes.find((cell) => cell.column === 5 && cell.row === 3)!.lockedBy).toBe(0)
    expect(after.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 3 })
  })
})
