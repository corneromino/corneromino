import { gsap } from 'gsap'
import type { VsCorner, VsPlacement } from './vsLocalGame'

const CORNER_TRANSITION_SECONDS = 0.12

/** Normalized marker position, independent of cell size and canvas resizing. */
export interface VsCornerPosition { x: number; y: number }

function cornerPosition(corner: VsCorner): VsCornerPosition {
  return { x: corner === 1 || corner === 2 ? 1 : 0, y: corner === 2 || corner === 3 ? 1 : 0 }
}

/** Keep the visual marker independent from the immediately updated game state. */
export function createVsCornerTransition(onUpdate: () => void, prefersReducedMotion: () => boolean) {
  let position: VsCornerPosition | null = null
  let current: VsPlacement | null = null

  function clear() {
    if (position) gsap.killTweensOf(position)
    position = null
    current = null
  }

  function sync(pending: VsPlacement | null): VsCornerPosition | null {
    if (!pending) {
      if (position) clear()
      return null
    }
    const target = cornerPosition(pending.corner)
    if (!position || !current || current.column !== pending.column || current.row !== pending.row) {
      clear()
      position = target
    } else if (current.corner !== pending.corner) {
      gsap.killTweensOf(position)
      if (prefersReducedMotion()) {
        Object.assign(position, target)
      } else {
        gsap.to(position, { ...target, duration: CORNER_TRANSITION_SECONDS, ease: 'power2.out', onUpdate })
      }
    }
    current = { ...pending }
    return position
  }

  return { sync, getPosition: () => position, destroy: clear }
}
