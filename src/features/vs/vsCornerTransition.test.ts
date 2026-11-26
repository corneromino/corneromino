import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVsCornerTransition } from './vsCornerTransition'

const tween = vi.hoisted(() => ({ to: vi.fn(), kill: vi.fn() }))
vi.mock('gsap', () => ({ gsap: { to: tween.to, killTweensOf: tween.kill } }))

beforeEach(() => {
  tween.to.mockReset()
  tween.kill.mockReset()
})

describe('VS pending corner transition', () => {
  it('starts at the initial corner and animates toward the latest target from its current position', () => {
    const onUpdate = vi.fn()
    const transition = createVsCornerTransition(onUpdate, () => false)
    const position = transition.sync({ column: 2, row: 3, corner: 1 })!
    expect(position).toEqual({ x: 1, y: 0 })
    expect(tween.to).not.toHaveBeenCalled()

    transition.sync({ column: 2, row: 3, corner: 3 })
    expect(tween.to).toHaveBeenLastCalledWith(position, expect.objectContaining({ x: 0, y: 1, duration: 0.12, ease: 'power2.out', onUpdate }))
    Object.assign(position, { x: 0.7, y: 0.3 })
    transition.sync({ column: 2, row: 3, corner: 0 })
    expect(tween.kill).toHaveBeenCalledWith(position)
    expect(position).toEqual({ x: 0.7, y: 0.3 })
    expect(tween.to).toHaveBeenLastCalledWith(position, expect.objectContaining({ x: 0, y: 0 }))
    transition.sync({ column: 2, row: 3, corner: 0 })
    expect(tween.to).toHaveBeenCalledTimes(2)
  })

  it('snaps for reduced motion and clears stale animations on replacement, confirmation, and destruction', () => {
    const transition = createVsCornerTransition(vi.fn(), () => true)
    const first = transition.sync({ column: 2, row: 3, corner: 0 })!
    expect(transition.sync({ column: 2, row: 3, corner: 2 })).toEqual({ x: 1, y: 1 })
    expect(tween.to).not.toHaveBeenCalled()
    const second = transition.sync({ column: 4, row: 3, corner: 3 })!
    expect(tween.kill).toHaveBeenCalledWith(first)
    expect(second).toEqual({ x: 0, y: 1 })
    transition.sync(null)
    expect(tween.kill).toHaveBeenCalledWith(second)
    expect(transition.getPosition()).toBeNull()
    const third = transition.sync({ column: 1, row: 1, corner: 1 })!
    transition.destroy()
    expect(tween.kill).toHaveBeenCalledWith(third)
    expect(transition.getPosition()).toBeNull()
  })
})
