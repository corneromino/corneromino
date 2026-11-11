import { describe, expect, it } from 'vitest'
import { getPerfectionPercentage, mergeCompletionResults } from './completionProgress'

describe('completion progress', () => {
  it('calculates perfection from cantomino and unlock counts', () => {
    expect(getPerfectionPercentage(10, 0)).toBe(100)
    expect(getPerfectionPercentage(10, 1)).toBeCloseTo(90.9090909)
    expect(getPerfectionPercentage(10, 10)).toBe(50)
  })

  it('keeps the best independently earned metrics', () => {
    expect(mergeCompletionResults(
      { bonusPercentage: 100, perfectionPercentage: 70 },
      { bonusPercentage: 50, perfectionPercentage: 100 },
    )).toEqual({ bonusPercentage: 100, perfectionPercentage: 100 })
  })
})
