import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SELECTED_CELL_SCALE } from '@/game/gameConfig'
import { createVsSelectionTransition } from './vsSelectionTransition'

const tween = vi.hoisted(() => ({ to: vi.fn(), kill: vi.fn() }))
vi.mock('gsap', () => ({ gsap: { to: tween.to, killTweensOf: tween.kill } }))

beforeEach(() => {
  tween.to.mockReset()
  tween.kill.mockReset()
})

describe('VS selection scale', () => {
  it('animates selection and deselection from the current scale', () => {
    const onUpdate = vi.fn()
    const transition = createVsSelectionTransition(onUpdate, () => false)
    transition.sync(['1,2'], new Set())
    expect(transition.scaleFor('1,2')).toBe(1)

    transition.sync(['1,2'], new Set(['1,2']))
    const motion = tween.to.mock.calls[0]![0] as { scale: number }
    expect(tween.to).toHaveBeenLastCalledWith(motion, expect.objectContaining({ scale: SELECTED_CELL_SCALE, duration: 0.15, ease: 'power2.out', onUpdate }))
    motion.scale = 0.92
    transition.sync(['1,2'], new Set())
    expect(tween.kill).toHaveBeenCalledWith(motion)
    expect(transition.scaleFor('1,2')).toBe(0.92)
    expect(tween.to).toHaveBeenLastCalledWith(motion, expect.objectContaining({ scale: 1, ease: 'power2.inOut' }))
    transition.sync(['1,2'], new Set())
    expect(tween.to).toHaveBeenCalledTimes(2)
    transition.destroy()
    expect(tween.kill).toHaveBeenCalledWith(motion)
  })

  it('snaps with reduced motion and clears removed cells', () => {
    const transition = createVsSelectionTransition(vi.fn(), () => true)
    transition.sync(['1,2'], new Set())
    transition.sync(['1,2'], new Set(['1,2']))
    expect(transition.scaleFor('1,2')).toBe(SELECTED_CELL_SCALE)
    expect(tween.to).not.toHaveBeenCalled()
    transition.sync([], new Set())
    expect(transition.scaleFor('1,2')).toBe(1)
    expect(tween.kill).toHaveBeenCalledTimes(2)
  })
})
