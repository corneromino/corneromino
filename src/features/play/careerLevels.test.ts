import { afterEach, describe, expect, it } from 'vitest'
import { careerLevels, getCareerLevel, getCurrentCareerLevelIndex, getNextCareerLevel, resolveCareerLevelPositions } from './careerLevels'

const initialLevels = [...careerLevels]

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
    expect(getCurrentCareerLevelIndex([{ completed: true, seed: 'one' }], levels)).toBe(2)
    expect(getCurrentCareerLevelIndex([{ completed: true, seed: 'one' }, { completed: true, seed: 'two' }], levels)).toBe(3)
  })
})
