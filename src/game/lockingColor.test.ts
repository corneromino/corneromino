import { afterEach, describe, expect, it, vi } from 'vitest'
import { chooseLockColor } from './lockingColor'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'

afterEach(() => vi.restoreAllMocks())

describe('chooseLockColor', () => {
  it('uses the normal lock rule to exclude edge- and corner-adjacent colors', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const color = chooseLockColor(['2,2'], [
      { cellKeys: ['1,2'], color: LOCKED_CELL_COLOR_HEX[0]! },
      { cellKeys: ['3,3'], color: LOCKED_CELL_COLOR_HEX[1]! },
    ])

    expect(color).toBe(LOCKED_CELL_COLOR_HEX[2])
  })
})
