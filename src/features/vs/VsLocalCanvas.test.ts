import { describe, expect, it } from 'vitest'
import { isVsCheckerboardCell } from './vsCheckerboard'

describe('Local VS checkerboard', () => {
  it('shades only the odd-parity board cells', () => {
    expect(isVsCheckerboardCell(0, 0)).toBe(false)
    expect(isVsCheckerboardCell(1, 0)).toBe(true)
    expect(isVsCheckerboardCell(0, 1)).toBe(true)
    expect(isVsCheckerboardCell(1, 1)).toBe(false)
  })
})
