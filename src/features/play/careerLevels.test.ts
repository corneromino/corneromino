import { afterEach, describe, expect, it } from 'vitest'
import { careerLevels, getCareerLevel, getNextCareerLevel } from './careerLevels'

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
})
