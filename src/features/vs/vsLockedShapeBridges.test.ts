import { describe, expect, it } from 'vitest'
import { getGridMetrics } from '@/rendering/grid/gridGeometry'
import { getVsLockedShapeBridges } from './vsLockedShapeBridges'

const metrics = getGridMetrics({ infinite: false, columns: 10, rows: 10 }, {
  width: 420, height: 520, cellSize: 40, fit: 'manual', offsetX: 10, offsetY: 20,
})

function fillsPoint(bridges: ReturnType<typeof getVsLockedShapeBridges>, x: number, y: number) {
  return bridges.some((bridge) => x > bridge.x && x < bridge.x + bridge.width && y > bridge.y && y < bridge.y + bridge.height)
}

describe('VS locked shape joins', () => {
  it('joins an O shape across both internal seams and its centre, preserving its outer border', () => {
    const bridges = getVsLockedShapeBridges([{ id: 'lock:1', player: 0, cellKeys: ['0,0', '1,0', '0,1', '1,1'] }], metrics, 1.5)
    expect(fillsPoint(bridges, 50, 40)).toBe(true)
    expect(fillsPoint(bridges, 30, 60)).toBe(true)
    expect(fillsPoint(bridges, 50, 60)).toBe(true)
    expect(fillsPoint(bridges, 10, 40)).toBe(false)
    expect(fillsPoint(bridges, 50, 20)).toBe(false)
  })

  it('keeps adjacent shapes separate even when owned by the same player', () => {
    const bridges = getVsLockedShapeBridges([
      { id: 'lock:1', player: 0, cellKeys: ['0,0', '1,0', '2,0', '3,0'] },
      { id: 'lock:2', player: 0, cellKeys: ['0,1', '1,1', '2,1', '3,1'] },
    ], metrics, 1.5)
    expect(fillsPoint(bridges, 50, 40)).toBe(true)
    expect(fillsPoint(bridges, 30, 60)).toBe(false)
  })

  it.each([
    ['0,0', '1,1', '2,2', '3,3'],
    ['1,0', '0,1', '-1,2', '-2,3'],
  ])('connects diagonal shapes at their shared corners (%s)', (...cellKeys) => {
    const bridges = getVsLockedShapeBridges([{ id: 'lock:1', player: 1, cellKeys }], metrics, 1.5)
    expect(fillsPoint(bridges, 50, 60)).toBe(true)
    expect(bridges.every((bridge) => bridge.player === 1)).toBe(true)
  })
})
