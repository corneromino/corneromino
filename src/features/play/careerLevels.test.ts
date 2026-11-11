import { afterEach, describe, expect, it } from 'vitest'
import { getBonusPercentage } from '@/game/bonus'
import { createTetrominoCells } from '@/game/tetrominoes'
import { careerLevels, getCareerLevel, getCurrentCareerLevelIndex, getNextCareerLevel, resolveCareerLevelPositions } from './careerLevels'

const initialLevels = [...careerLevels]

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
      { data: initialLevels[0]!.data, x: 0, y: 0 },
      { x: 100, y: 200 },
      { data: { ...initialLevels[0]!.data!, seed: 'next-level' }, x: 200, y: 400 },
    )

    const first = getCareerLevel(initialLevels[0]!.data!.seed)!
    const next = getNextCareerLevel(first)

    expect(careerLevels[1]).toEqual({ x: 100, y: 200 })
    expect(next).toMatchObject({ index: 2, number: 3, data: { seed: 'next-level' } })
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

  it('unlocks authored levels sequentially while skipping position-only entries', () => {
    const levels = [
      { data: { ...initialLevels[0]!.data!, seed: 'one' }, x: 0, y: 0 },
      { x: 0, y: 100 },
      { data: { ...initialLevels[0]!.data!, seed: 'two' }, x: 0, y: 200 },
      { data: { ...initialLevels[0]!.data!, seed: 'three' }, x: 0, y: 300 },
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
