import { describe, expect, it } from 'vitest'
import { getCareerInfiniteDifficulty } from './careerInfiniteDifficulty'

describe('infinite Career difficulty', () => {
  it.each([
    [10, 5, 7, 4, 0], [20, 6, 7, 6, 0.2], [49, 8, 10, 10, 0.4],
    [50, 8, 9, 11, 0.45], [70, 9, 10, 14, 0.62], [100, 10, 12, 19, 0.78],
    [125, 10, 14, 22, 0.83],
  ])('uses the intended milestone at level %i', (level, columns, rows, tetrominoCount, spread) => {
    expect(getCareerInfiniteDifficulty(level)).toMatchObject({ columns, rows, tetrominoCount, spread })
  })

  it('keeps every level within its board, density, empty-space and fallback limits', () => {
    for (const level of [...Array.from({ length: 1_000 }, (_, index) => index + 10), Number.MAX_SAFE_INTEGER]) {
      const config = getCareerInfiniteDifficulty(level)
      const area = config.columns * config.rows
      expect(area - config.tetrominoCount * 4, `level ${level}`).toBeGreaterThanOrEqual(10)
      expect(config.tetrominoCount * 4 / area, `level ${level}`).toBeLessThanOrEqual(0.68)
      expect(Math.floor(config.columns / 2) * Math.floor(config.rows / 2), `level ${level}`).toBeGreaterThanOrEqual(config.tetrominoCount)
      expect(config.spread).toBeGreaterThanOrEqual(0)
      expect(config.spread).toBeLessThanOrEqual(0.9)
      expect(config.tetrominoCount).toBeLessThanOrEqual(32)
      expect(getCareerInfiniteDifficulty(level)).toEqual(config)
    }
  })

  it('increases piece count at the main milestones while allowing a smaller, denser board', () => {
    for (const level of [20, 50, 70, 100]) {
      expect(getCareerInfiniteDifficulty(level).tetrominoCount).toBeGreaterThan(getCareerInfiniteDifficulty(level - 1).tetrominoCount)
    }
    const before = getCareerInfiniteDifficulty(49)
    const milestone = getCareerInfiniteDifficulty(50)
    expect(milestone.columns * milestone.rows).toBeLessThan(before.columns * before.rows)
    expect(milestone.spread).toBeGreaterThan(before.spread)
  })
})
