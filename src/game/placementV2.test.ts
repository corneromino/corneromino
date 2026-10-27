import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'
import { CELL_CORNERS, GAME_CONFIGS, type GameConfig } from './gameConfig'
import { generateTetrominoPlacementsV2 } from './placementV2'

describe('generateTetrominoPlacementsV2', () => {
  const testConfig: GameConfig = { columns: 8, rows: 8, spread: 0.5, tetrominoCount: 5, lockingMode: 'manual' }

  it('places every requested tetromino inside the board without overlaps and with every corner once', async () => {
    const pieces = await generateTetrominoPlacementsV2(testConfig, {
      random: createSeededRandom('placement-v2'),
      yieldEvery: 10,
    })
    const occupiedCells = pieces.flatMap((piece) => piece.cells.map((cell) => `${cell.x},${cell.y}`))

    expect(pieces).toHaveLength(testConfig.tetrominoCount)
    expect(pieces.map((piece) => piece.id)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(occupiedCells)).toHaveLength(occupiedCells.length)
    for (const piece of pieces) {
      expect(piece.cells).toHaveLength(4)
      expect(new Set(piece.cells.map((cell) => cell.cellId))).toEqual(new Set(['a', 'b', 'c', 'd']))
      expect(new Set(piece.cells.map((cell) => cell.corner))).toEqual(new Set(CELL_CORNERS))
      expect(piece.cells.every((cell) => cell.x >= 0 && cell.x < testConfig.columns && cell.y >= 0 && cell.y < testConfig.rows)).toBe(true)
    }
  })

  it('returns the same board for the same seeded random source', async () => {
    const first = await generateTetrominoPlacementsV2(testConfig, {
      random: createSeededRandom('same-v2-seed'),
    })
    const second = await generateTetrominoPlacementsV2(testConfig, {
      random: createSeededRandom('same-v2-seed'),
    })

    expect(first).toEqual(second)
  })

  it('generates every configured mode', async () => {
    for (const [mode, config] of Object.entries(GAME_CONFIGS)) {
      const pieces = await generateTetrominoPlacementsV2(config, {
        random: createSeededRandom(`${mode}:v2`),
      })

      expect(pieces).toHaveLength(config.tetrominoCount)
    }
  })

  it('uses different configurations for each game mode', () => {
    expect(GAME_CONFIGS.easy).not.toEqual(GAME_CONFIGS.medium)
    expect(GAME_CONFIGS.medium).not.toEqual(GAME_CONFIGS.hard)
  })

  it('requires spread to be between zero and one', async () => {
    await expect(generateTetrominoPlacementsV2({ ...testConfig, spread: -0.1 })).rejects.toThrow('Spread')
    await expect(generateTetrominoPlacementsV2({ ...testConfig, spread: 1.1 })).rejects.toThrow('Spread')
  })

  it('reports iterations while searching', async () => {
    const progress: number[] = []

    await generateTetrominoPlacementsV2(testConfig, {
      onProgress: (iterations) => progress.push(iterations),
      progressEvery: 10,
      random: createSeededRandom('v2-progress'),
      yieldEvery: 10,
    })

    expect(progress.length).toBeGreaterThan(0)
    expect(progress.every((iterations, index) => index === 0 || iterations > progress[index - 1])).toBe(true)
    expect(progress.slice(0, -1).every((iterations) => iterations % 10 === 0)).toBe(true)
  })

  it('reports the final iteration count even when no yield is needed', async () => {
    const progress: number[] = []

    await generateTetrominoPlacementsV2(testConfig, {
      onProgress: (iterations) => progress.push(iterations),
      random: createSeededRandom('v2-final-progress'),
      yieldEvery: 1_000_000,
    })

    expect(progress.at(-1)).toBeGreaterThan(0)
  })
})
