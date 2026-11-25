import { describe, expect, it } from 'vitest'
import { CELL_CORNERS, type GameConfig, type PlacedTetromino } from '@/game/gameConfig'
import { getTetrominoKind } from '@/game/tetrominoes'
import { getCareerInfiniteDifficulty } from './careerInfiniteDifficulty'
import { createCareerFallbackPieces, generateCareerInfinitePieces } from './careerInfiniteGeneration'

function expectValidBoard(config: GameConfig, pieces: readonly PlacedTetromino[]) {
  expect(pieces).toHaveLength(config.tetrominoCount)
  const occupied = new Set<string>()
  for (const [index, piece] of pieces.entries()) {
    expect(piece.id).toBe(index + 1)
    expect(piece.cells).toHaveLength(4)
    expect(getTetrominoKind(piece.cells)).toBe(piece.kind)
    expect(new Set(piece.cells.map((cell) => cell.corner))).toEqual(new Set(CELL_CORNERS))
    expect(new Set(piece.cells.map((cell) => cell.cellId))).toEqual(new Set(['a', 'b', 'c', 'd']))
    for (const cell of piece.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0)
      expect(cell.x).toBeLessThan(config.columns)
      expect(cell.y).toBeGreaterThanOrEqual(0)
      expect(cell.y).toBeLessThan(config.rows)
      const key = `${cell.x},${cell.y}`
      expect(occupied.has(key)).toBe(false)
      occupied.add(key)
    }
  }
  expect(config.columns * config.rows - occupied.size).toBeGreaterThanOrEqual(10)
}

describe('infinite Career generation', () => {
  it('constructs valid seeded fallbacks for every distinct configuration through the late-game cap', () => {
    const configs = new Map<string, GameConfig>()
    for (let level = 10; level <= 800; level++) {
      const config = getCareerInfiniteDifficulty(level)
      configs.set(`${config.columns},${config.rows},${config.tetrominoCount},${config.spread}`, config)
    }
    const kinds = new Set<string>()
    for (const [key, config] of configs) {
      const pieces = createCareerFallbackPieces(config, `fallback:${key}`)
      expectValidBoard(config, pieces)
      for (const piece of pieces) kinds.add(piece.kind)
    }
    expect(kinds.size).toBeGreaterThan(2)
    const config = getCareerInfiniteDifficulty(70)
    expect(createCareerFallbackPieces(config, 'repeatable')).toEqual(createCareerFallbackPieces(config, 'repeatable'))
  })

  it('generates valid boards for representative early and late levels', async () => {
    for (const level of [10, 20, 49, 50, 70, 100, 125, 250, 800]) {
      const config = getCareerInfiniteDifficulty(level)
      for (let seed = 0; seed < 3; seed++) {
        expectValidBoard(config, await generateCareerInfinitePieces(config, `test:${level}:${seed}`))
      }
    }
  }, 30_000)
})
