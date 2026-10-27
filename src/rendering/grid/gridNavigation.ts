import type { GridInputCallbacks } from './gridInput'

export interface GridView {
  zoom: number
  offsetX: number
  offsetY: number
}

interface Point { x: number; y: number }
interface Size { width: number; height: number }

interface GridNavigationOptions {
  getView: () => GridView
  setView: (view: GridView) => void
  getSize: () => Size
  minZoom: number
  maxZoom: number
  threshold?: number
  onTap: (event: PointerEvent) => void
  onNavigate?: () => void
  /** Editor handles can own single-pointer drags; a second pointer takes over for pinch. */
  tool?: {
    start: (event: PointerEvent) => boolean
    move: (event: PointerEvent) => void
    end: () => void
  }
}

/** Constrain a finite board to the viewport, centering any axis that fits. */
export function constrainGridView(view: GridView, viewport: Size, board: Size): GridView {
  const constrain = (offset: number, extent: number, content: number) => content <= extent
    ? (extent - content) / 2
    : Math.min(0, Math.max(extent - content, offset))
  return {
    ...view,
    offsetX: constrain(view.offsetX, viewport.width, board.width * view.zoom),
    offsetY: constrain(view.offsetY, viewport.height, board.height * view.zoom),
  }
}

/** Shared drag, anchored pinch and wheel gestures, used with attachGridInput(gestures: false). */
export function createGridNavigation(canvas: HTMLCanvasElement, options: GridNavigationOptions) {
  const pointers = new Map<number, Point>()
  const threshold = options.threshold ?? 8
  let lastPoint: Point | null = null
  let suppressedTap = false
  let toolActive = false
  let pinch: { distance: number; zoom: number; anchor: Point } | null = null

  function point(event: { clientX: number; clientY: number }): Point {
    const rect = canvas.getBoundingClientRect()
    const size = options.getSize()
    return { x: (event.clientX - rect.left) * size.width / rect.width, y: (event.clientY - rect.top) * size.height / rect.height }
  }

  function endTool() {
    if (toolActive) options.tool?.end()
    toolActive = false
  }

  function navigate() {
    if (!suppressedTap) options.onNavigate?.()
    suppressedTap = true
  }

  function beginPinch() {
    endTool()
    navigate()
    const [a, b] = [...pointers.values()]
    const view = options.getView()
    pinch = {
      distance: Math.hypot(b.x - a.x, b.y - a.y), zoom: view.zoom,
      anchor: { x: ((a.x + b.x) / 2 - view.offsetX) / view.zoom, y: ((a.y + b.y) / 2 - view.offsetY) / view.zoom },
    }
  }

  function zoomAt(zoom: number, center: Point, anchor: Point) {
    zoom = Math.min(options.maxZoom, Math.max(options.minZoom, zoom))
    options.setView({ zoom, offsetX: center.x - anchor.x * zoom, offsetY: center.y - anchor.y * zoom })
  }

  const callbacks: GridInputCallbacks = {
    onPointerDown(event) {
      pointers.set(event.pointerId, point(event))
      canvas.setPointerCapture(event.pointerId)
      if (pointers.size === 1) {
        suppressedTap = false
        lastPoint = point(event)
        toolActive = options.tool?.start(event) ?? false
      } else beginPinch()
    },
    onPointerMove(event) {
      if (!pointers.has(event.pointerId)) return
      const current = point(event)
      pointers.set(event.pointerId, current)
      if (pinch) {
        const [a, b] = [...pointers.values()]
        if (pinch.distance > 0) {
          zoomAt(pinch.zoom * Math.hypot(b.x - a.x, b.y - a.y) / pinch.distance, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pinch.anchor)
        } else beginPinch()
        return
      }
      if (toolActive) {
        options.tool?.move(event)
        return
      }
      if (!lastPoint || (!suppressedTap && Math.hypot(current.x - lastPoint.x, current.y - lastPoint.y) < threshold)) return
      navigate()
      const view = options.getView()
      options.setView({ ...view, offsetX: view.offsetX + current.x - lastPoint.x, offsetY: view.offsetY + current.y - lastPoint.y })
      lastPoint = current
    },
    onPointerUp: (event) => release(event, false),
    onPointerCancel: (event) => release(event, true),
    onWheel(event) {
      event.preventDefault()
      if (event.deltaY === 0) return
      // Wheel input also breaks a pending tap/double-tap, including at a zoom limit.
      options.onNavigate?.()
      if (pointers.size > 0) suppressedTap = true
      const view = options.getView()
      const center = point(event)
      zoomAt(view.zoom * (event.deltaY < 0 ? 1.1 : 0.9), center, {
        x: (center.x - view.offsetX) / view.zoom, y: (center.y - view.offsetY) / view.zoom,
      })
      if (pinch) beginPinch()
    },
  }

  function release(event: PointerEvent, cancelled: boolean) {
    if (!pointers.has(event.pointerId)) return
    const current = point(event)
    const moved = lastPoint && Math.hypot(current.x - lastPoint.x, current.y - lastPoint.y) >= threshold
    if (cancelled || moved) navigate()
    const tap = pointers.size === 1 && !suppressedTap && !toolActive
    pointers.delete(event.pointerId)
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    endTool()
    pinch = null
    lastPoint = pointers.values().next().value ?? null
    if (pointers.size >= 2) beginPinch()
    if (tap) options.onTap(event)
    if (pointers.size === 0) suppressedTap = false
  }

  function reset() {
    const ids = [...pointers.keys()]
    pointers.clear()
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
    endTool()
    lastPoint = null
    pinch = null
    suppressedTap = false
  }

  return { callbacks, reset }
}
