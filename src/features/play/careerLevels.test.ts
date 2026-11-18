import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBonusPercentage } from '@/game/bonus'
import { GAME_CONFIGS } from '@/game/gameConfig'
import { createTetrominoCells } from '@/game/tetrominoes'
import { EMPTY_CAREER_LEVEL_GENERATION, careerLevels, extendCareerLevelGeneration, getCareerLevel, getCurrentCareerLevelIndex, getNextCareerLevel, isClassicGameDefinitionCareerData, resolveCareerLevelConfigurations, resolveCareerLevelPositions } from './careerLevels'

const initialLevels = [...careerLevels]

function firstAuthoredDefinition() {
  const data = initialLevels[0]?.data
  if (!data || !isClassicGameDefinitionCareerData(data)) throw new Error('Expected the first Career level to use an authored board.')
  return data
}

function lockedShape(id: string, shape: 'I' | 'L' | 'O', rotation = 0, offsetX = 0) {
  return {
    cellKeys: createTetrominoCells(shape, rotation).map((cell) => `${cell.x + offsetX},${cell.y}`),
    color: '#000000',
    id,
  }
}

afterEach(() => {
  careerLevels.splice(0, careerLevels.length, ...initialLevels)
})

describe('Career levels', () => {
  it('keeps position-only levels visible in data while skipping them during play', () => {
    careerLevels.splice(0, careerLevels.length,
      { data: firstAuthoredDefinition(), x: 0, y: 0 },
      { x: 100, y: 200 },
      { data: { ...firstAuthoredDefinition(), seed: 'next-level' }, x: 200, y: 400 },
    )

    const first = getCareerLevel(firstAuthoredDefinition().seed)!
    const next = getNextCareerLevel(first)

    expect(careerLevels[1]).toEqual({ x: 100, y: 200 })
    expect(next).toMatchObject({ index: 2, number: 3, data: { seed: 'next-level' } })
  })

  it('preserves authored IDs while deriving generated IDs from their position', () => {
    careerLevels.splice(0, careerLevels.length,
      { data: firstAuthoredDefinition(), x: 0, y: 0 },
      { data: GAME_CONFIGS.c002, x: 0, y: 100 },
    )

    expect(getCareerLevel(firstAuthoredDefinition().seed)).toMatchObject({ id: firstAuthoredDefinition().seed, number: 1 })
    expect(getCareerLevel('level-2')).toMatchObject({ id: 'level-2', number: 2, data: GAME_CONFIGS.c002 })
  })

  it('resolves pixel-relative positions from the preceding level', () => {
    const positions = resolveCareerLevelPositions([
      { x: 40, y: 100 },
      { origin: 'relative', x: -80, y: 150 },
      { origin: 'relative', x: 120, y: -50 },
      { x: 0, y: 0 },
    ])

    expect(positions.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 40, y: 100 },
      { x: -40, y: 250 },
      { x: 80, y: 200 },
      { x: 0, y: 0 },
    ])
  })

  it('builds dynamic levels from their number and the preceding resolved configuration', () => {
    const builder = vi.fn((levelNumber: number, previousLevel: { x: number; y: number } | undefined) => ({
      data: { ...GAME_CONFIGS.c001, tetrominoCount: levelNumber + 2 },
      from: 'right' as const,
      origin: 'relative' as const,
      x: previousLevel!.x + 25,
    }))
    const levels = [
      { data: firstAuthoredDefinition(), from: 'bottom' as const, x: 40, y: 100 },
      { data: builder, from: 'top' as const, to: 'left' as const, x: 999, y: 75 },
    ]

    const [first, built] = resolveCareerLevelConfigurations(levels)

    expect(builder).toHaveBeenCalledWith(2, first)
    expect(built).toMatchObject({
      data: { tetrominoCount: 4 },
      from: 'right',
      origin: 'relative',
      to: 'left',
      x: 65,
      y: 75,
    })
    expect(resolveCareerLevelPositions(levels)[1]).toMatchObject({ x: 105, y: 175 })
    expect(builder).toHaveBeenCalledTimes(2)
  })

  it('expands repetitions into independently numbered levels and invokes builders for every copy', () => {
    const builder = vi.fn((levelNumber: number, previousLevel: { x: number; y: number } | undefined) => ({
      data: { ...GAME_CONFIGS.c001, tetrominoCount: levelNumber },
      x: previousLevel!.x + 10,
    }))
    const levels = [
      { data: { ...firstAuthoredDefinition(), seed: 'first' }, x: 0, y: 0 },
      { data: builder, origin: 'relative' as const, repeat: 3, x: 10, y: 25 },
      { data: GAME_CONFIGS.c002, x: 0, y: 200 },
    ]

    const configurations = resolveCareerLevelConfigurations(levels)
    const positions = resolveCareerLevelPositions(levels)

    expect(configurations).toHaveLength(6)
    expect(configurations.slice(1, 5).map((level) => (level.data as typeof GAME_CONFIGS.c001).tetrominoCount)).toEqual([2, 3, 4, 5])
    expect(builder).toHaveBeenNthCalledWith(1, 2, configurations[0])
    expect(builder).toHaveBeenNthCalledWith(2, 3, configurations[1])
    expect(builder).toHaveBeenNthCalledWith(3, 4, configurations[2])
    expect(builder).toHaveBeenNthCalledWith(4, 5, configurations[3])
    expect(positions.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'first', x: 0, y: 0 },
      { id: 'level-2', x: 10, y: 25 },
      { id: 'level-3', x: 30, y: 50 },
      { id: 'level-4', x: 60, y: 75 },
      { id: 'level-5', x: 100, y: 100 },
      { id: 'level-6', x: 0, y: 200 },
    ])
    expect(getCurrentCareerLevelIndex([{ seed: 'first' }, { seed: 'level-2' }], levels)).toBe(2)
  })

  it('assigns unique positional IDs to repeated authored boards', () => {
    careerLevels.splice(0, careerLevels.length, {
      data: { ...firstAuthoredDefinition(), seed: 'repeated-authored-board' },
      repeat: 1,
      x: 0,
      y: 0,
    })

    const first = getCareerLevel('repeated-authored-board')!
    const repeated = getCareerLevel('level-2')!

    expect(first).toMatchObject({ id: 'repeated-authored-board', number: 1 })
    expect(repeated).toMatchObject({ id: 'level-2', number: 2 })
    expect(getNextCareerLevel(first)).toMatchObject({ id: 'level-2', number: 2 })
  })

  it('materializes an infinite section one level at a time and leaves later entries pending', () => {
    const builder = vi.fn((levelNumber: number) => ({
      data: { ...GAME_CONFIGS.c001, tetrominoCount: levelNumber },
    }))
    const levels = [
      { data: { ...firstAuthoredDefinition(), seed: 'first' }, x: 0, y: 0 },
      { data: builder, origin: 'relative' as const, repeat: 'infinite' as const, x: 0, y: 100 },
      { data: GAME_CONFIGS.c002, origin: 'relative' as const, x: 0, y: 100 },
    ]

    careerLevels.splice(0, careerLevels.length, ...levels)
    const firstInfiniteLevel = getCareerLevel('level-2', EMPTY_CAREER_LEVEL_GENERATION)!
    const nextGeneration = extendCareerLevelGeneration(EMPTY_CAREER_LEVEL_GENERATION, firstInfiniteLevel.infiniteRepeat!)

    expect(resolveCareerLevelConfigurations(levels)).toHaveLength(2)
    expect(firstInfiniteLevel.infiniteRepeat).toEqual({ isTail: true, repeatIndex: 0, sourceIndex: 1 })
    expect(nextGeneration).toEqual({ infiniteRepeats: { 1: 2 } })
    expect(getCareerLevel('level-3', EMPTY_CAREER_LEVEL_GENERATION)).toBeNull()
    expect(getCareerLevel('level-3', nextGeneration)).toMatchObject({
      id: 'level-3',
      infiniteRepeat: { isTail: true, repeatIndex: 1, sourceIndex: 1 },
      number: 3,
    })
    expect(resolveCareerLevelConfigurations(levels, nextGeneration).slice(1).map((level) => (level.data as typeof GAME_CONFIGS.c001).tetrominoCount)).toEqual([2, 3])
    expect(resolveCareerLevelPositions(levels, nextGeneration).map(({ id }) => id)).toEqual(['first', 'level-2', 'level-3'])
  })

  it('unlocks authored levels sequentially while skipping position-only entries', () => {
    const levels = [
      { data: { ...firstAuthoredDefinition(), seed: 'one' }, x: 0, y: 0 },
      { x: 0, y: 100 },
      { data: { ...firstAuthoredDefinition(), seed: 'two' }, x: 0, y: 200 },
      { data: { ...firstAuthoredDefinition(), seed: 'three' }, x: 0, y: 300 },
    ]

    expect(getCurrentCareerLevelIndex([], levels)).toBe(0)
    expect(getCurrentCareerLevelIndex([{ seed: 'one' }], levels)).toBe(2)
    expect(getCurrentCareerLevelIndex([{ seed: 'one' }, { seed: 'two' }], levels)).toBe(3)
  })

  it('awards a bonus only when every shape requirement is fulfilled', () => {
    const groups = [
      lockedShape('first-l', 'L', 1),
      lockedShape('second-l', 'L', 1, 4),
      lockedShape('o', 'O', 0, 8),
    ]

    expect(getBonusPercentage([
      { count: 2, rotation: 1, shape: 'L' },
      { count: 1, shape: 'O' },
      { count: 0, shape: 'I' },
    ], groups)).toBe(100)
    expect(getBonusPercentage([{ count: 3, rotation: 1, shape: 'L' }], groups)).toBe(0)
    expect(getBonusPercentage([{ count: 0, shape: 'L' }], groups)).toBe(0)
    expect(getBonusPercentage([
      { count: 2, rotation: 1, shape: 'L' },
      { count: 2, shape: 'O' },
    ], groups)).toBe(50)
  })

  it('matches symmetric rotations by their visible shape', () => {
    const groups = [
      lockedShape('horizontal-i', 'I', 0),
      lockedShape('vertical-i', 'I', 1, 5),
      lockedShape('o', 'O', 0, 10),
    ]

    expect(getBonusPercentage([{ count: 1, rotation: 2, shape: 'I' }], groups)).toBe(100)
    expect(getBonusPercentage([{ count: 1, rotation: 3, shape: 'I' }], groups)).toBe(100)
    expect(getBonusPercentage([{ count: 1, rotation: 3, shape: 'O' }], groups)).toBe(100)
  })

  it('returns no bonus progress when a level has no bonus requirements', () => {
    expect(getBonusPercentage(undefined, [lockedShape('l', 'L')])).toBe(0)
  })
})
