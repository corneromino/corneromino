import { describe, expect, it } from 'vitest'
import { generateBonusRequirements } from './bonus'
import { CELL_CORNERS, type PlacedTetromino } from './gameConfig'
import { createSeededRandom } from './random'
import { createTetrominoCells, isTetrominoRotation, TETROMINOES, TETROMINO_KINDS, type TetrominoKind } from './tetrominoes'

function placedTetromino(shape: TetrominoKind, rotation: number, id: number): PlacedTetromino {
  const offset = id * 10
  return {
    cells: createTetrominoCells(shape, rotation).map((cell, index) => ({
      cellId: cell.id,
      corner: CELL_CORNERS[index]!,
      x: cell.x + offset,
      y: cell.y,
    })),
    id,
    kind: shape,
  }
}

function randomSequence(...values: number[]) {
  let index = 0
  return () => values[index++] ?? 0
}

describe('Classic bonus generation', () => {
  it('does not generate bonuses without both bounds', () => {
    expect(generateBonusRequirements([placedTetromino('O', 0, 1)], { bonusMin: 1 }, () => 0)).toEqual([])
    expect(generateBonusRequirements([placedTetromino('O', 0, 1)], { bonusMax: 1 }, () => 0)).toEqual([])
  })

  it('uses inclusive bonus bounds', () => {
    const bonuses = generateBonusRequirements(
      [placedTetromino('O', 0, 1)],
      { bonusMax: 4, bonusMin: 2 },
      randomSequence(0.999, 0, 0, 0, 0, 0, 0, 0, 0),
    )

    expect(bonuses).toHaveLength(4)
  })

  it('uses an absent shape and rotation for a zero-count bonus', () => {
    const pieces = [placedTetromino('O', 0, 1)]
    const [bonus] = generateBonusRequirements(pieces, { bonusMax: 1, bonusMin: 1 }, randomSequence(0, 0, 0))

    expect(bonus?.count).toBe(0)
    expect(pieces.some((piece) => piece.kind === bonus?.shape && isTetrominoRotation(piece.cells, piece.kind, bonus.rotation!))).toBe(false)
  })

  it('falls back to a counted requirement when every shape and rotation is present', () => {
    const pieces = TETROMINO_KINDS.flatMap((shape) => (
      TETROMINOES[shape].rotations.map((rotation, index) => placedTetromino(shape, rotation.turns, index + shape.charCodeAt(0)))
    ))

    const [bonus] = generateBonusRequirements(pieces, { bonusMax: 1, bonusMin: 1 }, randomSequence(0, 0, 0))

    expect(bonus).toEqual({ count: 1, rotation: 0, shape: 'I' })
  })

  it('uses the actual number of matching placed shapes for a counted requirement', () => {
    const pieces = [
      placedTetromino('L', 1, 1),
      placedTetromino('L', 1, 2),
      placedTetromino('O', 0, 3),
    ]

    expect(generateBonusRequirements(pieces, { bonusMax: 1, bonusMin: 1 }, randomSequence(0, 0.9, 0))).toEqual([
      { count: 2, rotation: 1, shape: 'L' },
    ])
  })

  it('is reproducible for the same board, bounds, and seed', () => {
    const pieces = [placedTetromino('L', 1, 1), placedTetromino('O', 0, 2)]
    const config = { bonusMax: 3, bonusMin: 1 }

    expect(generateBonusRequirements(pieces, config, createSeededRandom('classic-bonuses'))).toEqual(
      generateBonusRequirements(pieces, config, createSeededRandom('classic-bonuses')),
    )
  })
})
