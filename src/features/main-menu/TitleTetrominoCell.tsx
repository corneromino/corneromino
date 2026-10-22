import { useEffect, useRef, type RefObject } from 'react'

const CELLS = ['left', 'right'] as const
const MARKER_PADDING = 0.07

interface TitleTetrominoProps {
  pointerAreaRef: RefObject<HTMLElement | null>
}

export function TitleTetromino({ pointerAreaRef }: TitleTetrominoProps) {
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const area = pointerAreaRef.current
    if (!area) return

    let position: { x: number; y: number } | null = null
    let touchId: number | null = null
    let frame = 0

    function draw() {
      frame = 0
      const target = position
      if (!target) return

      // Read all geometry before writing transforms. Coordinates stay in CSS
      // pixels, including after scrolling, resizing, or a change in logo size.
      const cells = cellRefs.current.flatMap((cell, index) => {
        const marker = markerRefs.current[index]
        if (!cell || !marker) return []

        const bounds = cell.getBoundingClientRect()
        const centerX = (cell.clientWidth - marker.offsetWidth) / 2
        const centerY = (cell.clientHeight - marker.offsetHeight) / 2
        const radius = Math.max(0, Math.min(centerX, centerY) - cell.clientWidth * MARKER_PADDING)

        return [{
          marker, centerX, centerY, radius,
          screenX: bounds.left + cell.clientLeft + cell.clientWidth / 2,
          screenY: bounds.top + cell.clientTop + cell.clientHeight / 2,
        }]
      })
      if (cells.length === 0) return

      // Both markers share the same origin and displacement, so they stay
      // parallel even when the pointer is close to or between the cells.
      const originX = cells.reduce((sum, cell) => sum + cell.screenX, 0) / cells.length
      const originY = cells.reduce((sum, cell) => sum + cell.screenY, 0) / cells.length
      const dx = target.x - originX
      const dy = target.y - originY
      const radius = Math.min(...cells.map((cell) => cell.radius))
      const distance = Math.hypot(dx, dy)
      const scale = distance > 0 ? Math.min(1, radius / distance) : 0

      for (const cell of cells) {
        cell.marker.style.transform = `translate(${cell.centerX + dx * scale}px, ${cell.centerY + dy * scale}px)`
      }
    }

    function scheduleDraw() {
      if (position && !frame) frame = window.requestAnimationFrame(draw)
    }

    function follow(x: number, y: number) {
      position = { x, y }
      scheduleDraw()
    }

    function stop() {
      position = null
      touchId = null
      window.cancelAnimationFrame(frame)
      frame = 0
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== 'touch' && event.isPrimary && touchId === null) {
        follow(event.clientX, event.clientY)
      }
    }

    function onPointerLeave(event: PointerEvent) {
      if (event.pointerType !== 'touch' && touchId === null) stop()
    }

    // Passive touch events continue during native scrolling. Pointer events may
    // be cancelled when the browser takes over a pan or pinch gesture.
    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) {
        stop()
        return
      }
      const touch = event.touches[0]!
      touchId = touch.identifier
      follow(touch.clientX, touch.clientY)
    }

    function onTouchMove(event: TouchEvent) {
      const touch = Array.from(event.touches).find((item) => item.identifier === touchId)
      if (touch) follow(touch.clientX, touch.clientY)
    }

    function onTouchEnd(event: TouchEvent) {
      if (Array.from(event.changedTouches).some((touch) => touch.identifier === touchId)) stop()
    }

    const resizeObserver = new ResizeObserver(scheduleDraw)
    for (const cell of cellRefs.current) {
      if (cell) resizeObserver.observe(cell)
    }
    area.addEventListener('pointermove', onPointerMove, { passive: true })
    area.addEventListener('pointerleave', onPointerLeave, { passive: true })
    area.addEventListener('touchstart', onTouchStart, { passive: true })
    area.addEventListener('touchmove', onTouchMove, { passive: true })
    area.addEventListener('touchend', onTouchEnd, { passive: true })
    area.addEventListener('touchcancel', stop, { passive: true })
    window.addEventListener('scroll', scheduleDraw, { capture: true, passive: true })
    window.addEventListener('resize', scheduleDraw, { passive: true })
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)

    return () => {
      stop()
      resizeObserver.disconnect()
      area.removeEventListener('pointermove', onPointerMove)
      area.removeEventListener('pointerleave', onPointerLeave)
      area.removeEventListener('touchstart', onTouchStart)
      area.removeEventListener('touchmove', onTouchMove)
      area.removeEventListener('touchend', onTouchEnd)
      area.removeEventListener('touchcancel', stop)
      window.removeEventListener('scroll', scheduleDraw, true)
      window.removeEventListener('resize', scheduleDraw)
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
    }
  }, [pointerAreaRef])

  return (
    <div aria-hidden="true" className="main-menu-logo pointer-events-none grid select-none grid-cols-2 grid-rows-2 gap-1">
      {CELLS.map((cell, index) => (
        <div className="relative row-start-2 aspect-square rounded-[2%] border-4 border-[#773526] bg-[#ffd18a]" key={cell} ref={(element) => { cellRefs.current[index] = element }}>
          <span
            className="absolute left-0 top-0 z-10 aspect-square w-1/2 rounded-[10%] bg-[var(--outline-color)] transition-transform duration-100 ease-out motion-reduce:transition-none"
            ref={(element) => { markerRefs.current[index] = element }}
            style={{ transform: 'translate(86%, 14%)' }}
          />
        </div>
      ))}
    </div>
  )
}
