import { describe, expect, it } from 'vitest'
import { LOCKED_CELL_COLOR_HEX, LOCKED_CELL_COLORS, pixiColorToCss } from './colors'
import { VS_PLAYERS } from '@/features/vs/vsLocalGame'

describe('shared locked-cell palette', () => {
  it('keeps Pixi, CSS, and Local VS locked colours aligned', () => {
    expect(LOCKED_CELL_COLORS).toEqual([
      0x55c7df, 0x8270d8, 0xbe69d6, 0xde5d9b, 0xe4555c, 0x5fc47a,
      0x4db9a7, 0x73a9ee, 0x9d71dc, 0x41ead4, 0x0b987e,
    ])
    expect(LOCKED_CELL_COLOR_HEX).toEqual(LOCKED_CELL_COLORS.map(pixiColorToCss))
    expect(VS_PLAYERS[0].lockedColor).toBe(LOCKED_CELL_COLORS[0])
    expect(VS_PLAYERS[1].lockedColor).toBe(LOCKED_CELL_COLORS[4])
    expect(VS_PLAYERS[0].bannerBorder).toBe(LOCKED_CELL_COLOR_HEX[0])
    expect(VS_PLAYERS[1].bannerBorder).toBe(LOCKED_CELL_COLOR_HEX[4])
  })
})
