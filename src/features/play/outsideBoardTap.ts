interface PointerPoint {
  pointerId: number
  clientX: number
  clientY: number
  timeStamp: number
}

/** Recognize a single stationary tap that starts and ends outside the board. */
export function createOutsideBoardTap(onTap: () => void, hitTest: (point: PointerPoint) => boolean | null) {
  const pointers = new Set<number>()
  let candidate: PointerPoint | null = null
  let blocked = false
  return {
    down(event: PointerPoint, eligible: boolean) {
      pointers.add(event.pointerId)
      if (pointers.size > 1) { blocked = true; candidate = null; return }
      candidate = eligible && hitTest(event) === false ? { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, timeStamp: event.timeStamp } : null
    },
    move(event: PointerPoint) {
      if (candidate?.pointerId === event.pointerId && Math.hypot(event.clientX - candidate.clientX, event.clientY - candidate.clientY) >= 8) candidate = null
    },
    up(event: PointerPoint, eligible: boolean) {
      if (!pointers.delete(event.pointerId)) return
      if (candidate?.pointerId === event.pointerId) {
        if (!blocked && eligible && event.timeStamp - candidate.timeStamp < 500 && Math.hypot(event.clientX - candidate.clientX, event.clientY - candidate.clientY) < 8 && hitTest(event) === false) onTap()
        candidate = null
      }
      if (pointers.size === 0) blocked = false
    },
    cancel(event: PointerPoint) {
      pointers.delete(event.pointerId)
      candidate = null
      if (pointers.size === 0) blocked = false
    },
  }
}
