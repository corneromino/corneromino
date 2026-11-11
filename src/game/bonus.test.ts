import { describe, expect, it } from 'vitest'
import { generateBonusRequirements, hasDuplicateBonusRequirements } from './bonus'
import { CELL_CORNERS, GAME_CONFIGS, type PlacedTetromino } from './gameConfig'
import { generateTetrominoPlacementsV2 } from './placementV2'
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

  it('chooses a positive count from one through the number of matching placed shapes', () => {
    const pieces = [
      placedTetromino('L', 1, 1),
      placedTetromino('L', 1, 2),
      placedTetromino('O', 0, 3),
    ]

    expect(generateBonusRequirements(pieces, { bonusMax: 1, bonusMin: 1 }, randomSequence(0, 0.9, 0, 0.999))).toEqual([
      { count: 2, rotation: 1, shape: 'L' },
    ])
    expect(generateBonusRequirements(pieces, { bonusMax: 1, bonusMin: 1 }, randomSequence(0, 0.9, 0, 0))).toEqual([
      { count: 1, rotation: 1, shape: 'L' },
    ])
  })

  it('does not repeat a shape and rotation requirement', () => {
    const pieces = [
      placedTetromino('diagonal', 0, 1),
      placedTetromino('diagonal', 0, 2),
      placedTetromino('O', 0, 3),
    ]
    const bonuses = generateBonusRequirements(pieces, { bonusMax: 2, bonusMin: 2 }, randomSequence(0, 0.9, 0, 0.999, 0.9, 0, 0))

    expect(bonuses).toHaveLength(2)
    expect(hasDuplicateBonusRequirements(bonuses)).toBe(false)
    expect(bonuses).toEqual([
      { count: 2, rotation: 0, shape: 'diagonal' },
      { count: 1, rotation: 0, shape: 'O' },
    ])
  })

  it('recognizes duplicate saved requirements', () => {
    expect(hasDuplicateBonusRequirements([
      { count: 4, rotation: 0, shape: 'diagonal' },
      { count: 4, rotation: 0, shape: 'diagonal' },
    ])).toBe(true)
  })

  it('does not repeat bonuses for the reported c004 board seed', async () => {
    const seed = 'c004:487e3f37-4948-4d15-9469-65dc1b37a5b4'
    const config = { ...GAME_CONFIGS.c004, bonusMax: 2, bonusMin: 2 }
    const pieces = await generateTetrominoPlacementsV2(config, {
      random: createSeededRandom(seed),
      yieldEvery: 250,
    })

    const bonuses = generateBonusRequirements(pieces, config, createSeededRandom(`${seed}:bonus`))

    expect(bonuses).toHaveLength(2)
    expect(hasDuplicateBonusRequirements(bonuses)).toBe(false)
  })

  it('is reproducible for the same board, bounds, and seed', () => {
    const pieces = [placedTetromino('L', 1, 1), placedTetromino('O', 0, 2)]
    const config = { bonusMax: 3, bonusMin: 1 }

    expect(generateBonusRequirements(pieces, config, createSeededRandom('classic-bonuses'))).toEqual(
      generateBonusRequirements(pieces, config, createSeededRandom('classic-bonuses')),
    )
  })
})
