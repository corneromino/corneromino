import { gsap } from 'gsap'
import { SELECTED_CELL_SCALE } from '@/game/gameConfig'

/** Animates only visual scale; selection and move rules remain immediate. */
export function createVsSelectionTransition(onUpdate: () => void, prefersReducedMotion: () => boolean) {
  const cells = new Map<string, { scale: number; selected: boolean }>()

  function sync(cellKeys: readonly string[], selectedKeys: ReadonlySet<string>) {
    const present = new Set(cellKeys)
    for (const [key, motion] of cells) {
      if (present.has(key)) continue
      gsap.killTweensOf(motion)
      cells.delete(key)
    }
    for (const key of cellKeys) {
      const selected = selectedKeys.has(key)
      const target = selected ? SELECTED_CELL_SCALE : 1
      const motion = cells.get(key)
      if (!motion) {
        cells.set(key, { scale: target, selected })
      } else if (motion.selected !== selected) {
        motion.selected = selected
        gsap.killTweensOf(motion)
        if (prefersReducedMotion()) motion.scale = target
        else gsap.to(motion, { scale: target, duration: 0.15, ease: selected ? 'power2.out' : 'power2.inOut', onUpdate })
      }
    }
  }

  function destroy() {
    for (const motion of cells.values()) gsap.killTweensOf(motion)
    cells.clear()
  }

  return { sync, scaleFor: (key: string) => cells.get(key)?.scale ?? 1, destroy }
}
