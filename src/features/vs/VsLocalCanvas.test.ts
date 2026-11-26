import { describe, expect, it, vi } from 'vitest'
import type { Graphics } from 'pixi.js'
import { drawCellBody } from '@/rendering/grid/drawMarkedCell'
import { getGridSquircleRadius } from '@/rendering/grid/gridSquircle'
import { drawVsCellOverlay, VS_CELL_BORDER_SIZE } from './drawVsCellOverlay'
import { isVsCheckerboardCell } from './vsCheckerboard'

describe('Local VS checkerboard', () => {
  it('shades only the odd-parity board cells', () => {
    expect(isVsCheckerboardCell(0, 0)).toBe(false)
    expect(isVsCheckerboardCell(1, 0)).toBe(true)
    expect(isVsCheckerboardCell(0, 1)).toBe(true)
    expect(isVsCheckerboardCell(1, 1)).toBe(false)
  })
})

describe('Local VS cell overlays', () => {
  it.each([12, 30, 80, 150])('matches the underlying cell face at size %i', (size) => {
    const graphics = { roundRect: vi.fn().mockReturnThis(), fill: vi.fn().mockReturnThis() } as unknown as Graphics
    drawCellBody(graphics, 10, 20, size, size, {
      fillColor: 0xeeeeee, borderColor: 0x111111,
      borderSize: VS_CELL_BORDER_SIZE, borderRadius: getGridSquircleRadius(size),
    })
    const face = vi.mocked(graphics.roundRect).mock.calls[1]
    vi.mocked(graphics.roundRect).mockClear()
    drawVsCellOverlay(graphics, 10, 20, size, size, 0x123456, 0.32)
    expect(graphics.roundRect).toHaveBeenCalledWith(...face)
    expect(graphics.fill).toHaveBeenLastCalledWith({ color: 0x123456, alpha: 0.32 })
  })
})
