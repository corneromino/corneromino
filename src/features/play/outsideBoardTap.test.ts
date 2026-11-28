import { describe, expect, it, vi } from 'vitest'
import { createOutsideBoardTap } from './outsideBoardTap'

const point = (clientX: number, clientY = 10, pointerId = 1, timeStamp = 0) => ({ clientX, clientY, pointerId, timeStamp })

describe('outside-board taps', () => {
  it('toggles only for a stationary tap that starts and ends outside the current board', () => {
    const onTap = vi.fn()
    const tap = createOutsideBoardTap(onTap, ({ clientX }) => clientX >= 100)
    tap.down(point(10), true); tap.up(point(10, 10, 1, 100), true)
    expect(onTap).toHaveBeenCalledOnce()
    tap.down(point(100), true); tap.up(point(10), true)
    tap.down(point(99), true); tap.up(point(100), true)
    tap.down(point(10), false); tap.up(point(10), true)
    tap.down(point(10), true); tap.up(point(10), false)
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('ignores movement, long presses, cancellation, and multi-touch', () => {
    const onTap = vi.fn()
    const tap = createOutsideBoardTap(onTap, () => false)
    tap.down(point(10), true); tap.move(point(20)); tap.up(point(10), true)
    tap.down(point(10), true); tap.up(point(10, 10, 1, 500), true)
    tap.down(point(10), true); tap.cancel(point(10)); tap.up(point(10), true)
    tap.down(point(10), true); tap.down(point(20, 10, 2), true); tap.up(point(20, 10, 2), true); tap.up(point(10), true)
    expect(onTap).not.toHaveBeenCalled()
    tap.down(point(10), true); tap.up(point(10), true)
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('does not toggle while the board hit test is unavailable', () => {
    const onTap = vi.fn()
    const tap = createOutsideBoardTap(onTap, () => null)
    tap.down(point(10), true); tap.up(point(10), true)
    expect(onTap).not.toHaveBeenCalled()
  })
})
