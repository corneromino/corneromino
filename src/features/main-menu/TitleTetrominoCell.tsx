import { useEffect, useRef } from 'react'

const FOLLOWER_CELLS = [
  { id: 'bottom-left', positionClass: 'col-start-1 row-start-2' },
  { id: 'bottom-right', positionClass: 'col-start-2 row-start-2' },
] as const
const MARKER_SIZE = 0.5
const MARKER_PADDING = 0.07
const MARKER_MAX_POSITION = 1 - MARKER_SIZE - MARKER_PADDING
const FOLLOW_TIME_MS = 65
const SETTLE_THRESHOLD = 0.0005
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"], [contenteditable="true"]'

function clampPosition(position: number) {
  return Math.min(MARKER_MAX_POSITION, Math.max(MARKER_PADDING, position))
}

export function TitleTetromino() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const menu = root?.closest('main')
    if (!root || !menu) return

    const markers = Array.from(root.children, (element) => {
      const cell = element as HTMLDivElement
      return {
        cell,
        marker: cell.firstElementChild as HTMLSpanElement,
        x: MARKER_MAX_POSITION,
        y: MARKER_PADDING,
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      }
    })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let pointerId: number | null = null
    let pointer: { x: number; y: number } | null = null
    let frame = 0
    let lastTime = 0
    let needsMeasurement = true

    function scheduleFrame() {
      if (frame || !pointer) return
      frame = window.requestAnimationFrame(animate)
    }

    function animate(time: number) {
      frame = 0
      if (!pointer) return

      // Batch layout reads before transform writes. Pointer events only update
      // the latest target; they never render React or force layout themselves.
      if (needsMeasurement) {
        for (const item of markers) {
          const bounds = item.cell.getBoundingClientRect()
          item.left = bounds.left + item.cell.clientLeft
          item.top = bounds.top + item.cell.clientTop
          item.width = Math.max(1, item.cell.clientWidth)
          item.height = Math.max(1, item.cell.clientHeight)
        }
        needsMeasurement = false
      }

      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 16
      lastTime = time
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / FOLLOW_TIME_MS)
      let unsettled = false
      for (const item of markers) {
        const targetX = clampPosition((pointer.x - item.left) / item.width - MARKER_SIZE / 2)
        const targetY = clampPosition((pointer.y - item.top) / item.height - MARKER_SIZE / 2)
        item.x += (targetX - item.x) * blend
        item.y += (targetY - item.y) * blend
        if (Math.abs(targetX - item.x) + Math.abs(targetY - item.y) < SETTLE_THRESHOLD) {
          item.x = targetX
          item.y = targetY
        } else {
          unsettled = true
        }
        // Transform percentages are relative to the marker, which is half a cell.
        item.marker.style.transform = `translate3d(${item.x / MARKER_SIZE * 100}%, ${item.y / MARKER_SIZE * 100}%, 0)`
      }
      if (unsettled) scheduleFrame()
      else lastTime = 0
    }

    function handlePointerDown(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return
      if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) return
      pointerId = event.pointerId
      pointer = { x: event.clientX, y: event.clientY }
      needsMeasurement = true
      scheduleFrame()
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== pointerId) return
      if (event.buttons === 0) {
        pointerId = null
        return
      }
      pointer = { x: event.clientX, y: event.clientY }
      scheduleFrame()
    }

    function releasePointer(event: PointerEvent) {
      if (event.pointerId === pointerId) pointerId = null
    }

    function stopTracking() {
      pointerId = null
      pointer = null
      window.cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
    }

    function invalidateMeasurements() {
      needsMeasurement = true
      scheduleFrame()
    }

    const resizeObserver = new ResizeObserver(invalidateMeasurements)
    resizeObserver.observe(menu)
    resizeObserver.observe(root)
    // Passive observation only: no pointer capture, default prevention, or
    // delayed click handlers, so navigation keeps its native response.
    menu.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', releasePointer, { passive: true })
    window.addEventListener('pointercancel', releasePointer, { passive: true })
    window.addEventListener('resize', invalidateMeasurements, { passive: true })
    window.addEventListener('scroll', invalidateMeasurements, { passive: true })
    window.addEventListener('blur', stopTracking)
    document.addEventListener('visibilitychange', stopTracking)

    return () => {
      stopTracking()
      resizeObserver.disconnect()
      menu.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
      window.removeEventListener('resize', invalidateMeasurements)
      window.removeEventListener('scroll', invalidateMeasurements)
      window.removeEventListener('blur', stopTracking)
      document.removeEventListener('visibilitychange', stopTracking)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none grid size-[132px] select-none grid-cols-2 grid-rows-2 gap-1" ref={rootRef}>
      {FOLLOWER_CELLS.map((cell) => (
        <div className={`relative aspect-square rounded-[2%] border-4 border-[#773526] bg-[#ffd18a] ${cell.positionClass}`} key={cell.id}>
          <span
            className="absolute left-0 top-0 z-10 aspect-square w-1/2 rounded-[10%] bg-[var(--outline-color)] will-change-transform"
            style={{ transform: `translate3d(${MARKER_MAX_POSITION / MARKER_SIZE * 100}%, ${MARKER_PADDING / MARKER_SIZE * 100}%, 0)` }}
          />
        </div>
      ))}
    </div>
  )
}
