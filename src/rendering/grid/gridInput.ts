export interface GridCellEvent {
  column: number
  row: number
  originalEvent: PointerEvent
}

export interface GridSwipeEvent extends GridCellEvent {
  steps: number
}

export interface GridInputCallbacks {
  onCellTap?: (event: GridCellEvent) => void
  onSwipeLeft?: (event: GridSwipeEvent) => void
  onSwipeRight?: (event: GridSwipeEvent) => void
  onSwipeUp?: (event: GridSwipeEvent) => void
  onSwipeDown?: (event: GridSwipeEvent) => void
  /** Low-level callbacks allow mode-owned selection handles, pan and pinch tools. */
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
  onWheel?: (event: WheelEvent) => void
}

export interface GridInputOptions {
  enabled?: () => boolean
  cellAt: (event: PointerEvent) => { column: number; row: number }
  callbacks: GridInputCallbacks
  /** Custom tools own gestures when false; pointer callbacks still run. */
  gestures?: boolean
  threshold?: number
  horizontalSteps?: boolean
}

/** One pointer lifecycle and callback contract shared by all game canvases. */
export function attachGridInput(canvas: HTMLCanvasElement, options: GridInputOptions): () => void {
  const { callbacks } = options
  const threshold = options.threshold ?? 8
  const pointers = new Set<number>()
  let start: { pointerId: number; x: number; y: number; stepX: number; stepped: boolean } | null = null
  let moved = false
  let multiTouch = false
  const enabled = () => options.enabled?.() ?? true
  const cellEvent = (event: PointerEvent): GridCellEvent => ({ ...options.cellAt(event), originalEvent: event })

  function down(event: PointerEvent) {
    if (!enabled() || event.button !== 0) return
    pointers.add(event.pointerId)
    if (options.gestures !== false) {
      canvas.setPointerCapture(event.pointerId)
      if (pointers.size === 1) {
        start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, stepX: event.clientX, stepped: false }
        moved = false
        multiTouch = false
      } else multiTouch = true
    }
    callbacks.onPointerDown?.(event)
  }

  function move(event: PointerEvent) {
    if (!pointers.has(event.pointerId) || !enabled()) return
    callbacks.onPointerMove?.(event)
    if (!start || start.pointerId !== event.pointerId || multiTouch) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) >= threshold) moved = true
    if (!options.horizontalSteps || Math.abs(dx) <= Math.abs(dy)) return
    const stepDelta = event.clientX - start.stepX
    const steps = Math.floor(Math.abs(stepDelta) / threshold)
    if (!steps) return
    const callback = stepDelta < 0 ? callbacks.onSwipeLeft : callbacks.onSwipeRight
    callback?.({ ...cellEvent(event), steps })
    start.stepX += Math.sign(stepDelta) * steps * threshold
    start.stepped = true
  }

  function release(event: PointerEvent, cancelled: boolean) {
    if (!pointers.delete(event.pointerId)) return
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (cancelled || !enabled()) callbacks.onPointerCancel?.(event)
    else callbacks.onPointerUp?.(event)
    if (start?.pointerId === event.pointerId) {
      const gesture = start
      start = null
      if (!cancelled && enabled() && !multiTouch) {
        const dx = event.clientX - gesture.x
        const dy = event.clientY - gesture.y
        if (!moved && Math.hypot(dx, dy) < threshold) callbacks.onCellTap?.(cellEvent(event))
        else if (!gesture.stepped && Math.max(Math.abs(dx), Math.abs(dy)) >= threshold) {
          const callback = Math.abs(dx) > Math.abs(dy)
            ? dx < 0 ? callbacks.onSwipeLeft : callbacks.onSwipeRight
            : dy < 0 ? callbacks.onSwipeUp : callbacks.onSwipeDown
          callback?.({ ...cellEvent(event), steps: 1 })
        }
      }
    }
    if (pointers.size === 0) multiTouch = false
  }
  const up = (event: PointerEvent) => release(event, false)
  const cancel = (event: PointerEvent) => release(event, true)
  const wheel = (event: WheelEvent) => { if (enabled()) callbacks.onWheel?.(event) }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('lostpointercapture', cancel)
  if (callbacks.onWheel) canvas.addEventListener('wheel', wheel, { passive: false })
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', cancel)
    canvas.removeEventListener('lostpointercapture', cancel)
    canvas.removeEventListener('wheel', wheel)
    for (const id of pointers) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
    pointers.clear()
    start = null
  }
}
