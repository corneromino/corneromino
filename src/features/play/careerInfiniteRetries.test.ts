import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTetrominoPlacementsV2, PlacementSearchLimitError } from '@/game/placementV2'
import { getCareerInfiniteDifficulty } from './careerInfiniteDifficulty'
import { CAREER_PLACEMENT_ATTEMPTS, CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT, createCareerFallbackPieces, generateCareerInfinitePieces } from './careerInfiniteGeneration'

vi.mock('@/game/placementV2', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/game/placementV2')>(),
  generateTetrominoPlacementsV2: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(generateTetrominoPlacementsV2).mockReset()
})

describe('bounded infinite Career placement', () => {
  const config = getCareerInfiniteDifficulty(70)

  it('retries a search limit with a new seed and keeps the same difficulty', async () => {
    const pieces = createCareerFallbackPieces(config, 'success')
    vi.mocked(generateTetrominoPlacementsV2)
      .mockRejectedValueOnce(new PlacementSearchLimitError(CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT))
      .mockResolvedValueOnce(pieces)

    await expect(generateCareerInfinitePieces(config, 'board-seed')).resolves.toBe(pieces)
    const calls = vi.mocked(generateTetrominoPlacementsV2).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe(config)
    expect(calls[1][0]).toBe(config)
    expect(calls[0][1]).toMatchObject({ maxIterations: CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT, yieldEvery: 250 })
    expect(calls[0][1]!.random!()).not.toBe(calls[1][1]!.random!())
  })

  it('uses the validated constructive fallback after all bounded attempts', async () => {
    vi.mocked(generateTetrominoPlacementsV2).mockRejectedValue(new PlacementSearchLimitError(CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT))
    await expect(generateCareerInfinitePieces(config, 'board-seed')).resolves.toEqual(createCareerFallbackPieces(config, 'board-seed:fallback'))
    expect(generateTetrominoPlacementsV2).toHaveBeenCalledTimes(CAREER_PLACEMENT_ATTEMPTS)
  })

  it('does not hide unrelated generator errors', async () => {
    const failure = new Error('Unexpected generation failure')
    vi.mocked(generateTetrominoPlacementsV2).mockRejectedValue(failure)
    await expect(generateCareerInfinitePieces(config, 'board-seed')).rejects.toBe(failure)
    expect(generateTetrominoPlacementsV2).toHaveBeenCalledOnce()
  })
})
