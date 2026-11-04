import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { CanvasStartupError } from '@/rendering/pixi/CanvasStartupError'
import { GAME_COLORS } from '@/rendering/colors'
import { PixiCanvasHost } from '@/rendering/pixi/PixiCanvasHost'
import { CAREER_CHAPTERS, type CareerChapter } from './chapters'
import { createCareerMapLayout } from './careerMapLayout'

const PATH_DASH_LENGTH = 20
const PATH_GAP_LENGTH = 5
const CAREER_PATH_THICKNESS = 30
/** Screen-pixel separation between tiles belonging to the same Nokomino. */
export const CAREER_PLATFORM_TILE_GAP = 2
/** Rounded radius for the top diamond face of a Career tile. */
export const CAREER_TILE_CORNER_RADIUS = 10
/** Number of darker decorative tiles placed across the Career map. */
export const CAREER_DECORATION_TILE_COUNT = 10
export const CAREER_DECORATION_TILE_SCALE = 1

interface Point {
  x: number
  y: number
}

function darken(color: number, amount: number): number {
  const red = Math.max(0, ((color >> 16) & 0xff) - amount)
  const green = Math.max(0, ((color >> 8) & 0xff) - amount)
  const blue = Math.max(0, (color & 0xff) - amount)
  return (red << 16) | (green << 8) | blue
}

function createSeededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

function cubicPoint(start: Point, controlOne: Point, controlTwo: Point, end: Point, progress: number): Point {
  const inverse = 1 - progress
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * controlOne.x + 3 * inverse * progress ** 2 * controlTwo.x + progress ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * controlOne.y + 3 * inverse * progress ** 2 * controlTwo.y + progress ** 3 * end.y,
  }
}

function drawDashedPolyline(graphics: Graphics, points: readonly Point[], color: number) {
  let drawing = true
  let remaining = PATH_DASH_LENGTH
  let dash: Point[] = []

  function strokeDash() {
    if (dash.length < 2) return
    graphics.moveTo(dash[0]!.x, dash[0]!.y)
    for (const point of dash.slice(1)) graphics.lineTo(point.x, point.y)
    graphics.stroke({ alpha: 0.7, cap: 'butt', color, join: 'round', width: CAREER_PATH_THICKNESS })
    dash = []
  }

  for (let index = 1; index < points.length; index += 1) {
    let start = points[index - 1]!
    const end = points[index]!
    let length = Math.hypot(end.x - start.x, end.y - start.y)
    while (length > 0.001) {
      const portion = Math.min(length, remaining)
      const progress = portion / length
      const next = { x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress }
      if (drawing) {
        if (dash.length === 0) dash.push(start)
        else if (dash.at(-1)!.x !== start.x || dash.at(-1)!.y !== start.y) dash.push(start)
        dash.push(next)
      }
      start = next
      length -= portion
      remaining -= portion
      if (remaining <= 0.001) {
        if (drawing) strokeDash()
        drawing = !drawing
        remaining = drawing ? PATH_DASH_LENGTH : PATH_GAP_LENGTH
      }
    }
  }
  if (drawing) strokeDash()
}

function drawCareerPath(graphics: Graphics, chapters: ReturnType<typeof createCareerMapLayout>['chapters'], mapHeight: number, color: number) {
  if (chapters.length === 0) return
  // Overscan prevents a visible dash cap at either end of the scrollable map.
  const overscan = CAREER_PATH_THICKNESS + PATH_DASH_LENGTH
  const points: Point[] = [{ x: chapters[0]!.centerX, y: mapHeight + overscan }]
  for (let index = 0; index < chapters.length - 1; index += 1) {
    const start = chapters[index]!
    const end = chapters[index + 1]!
    const verticalDistance = end.centerY - start.centerY
    const controlOne = { x: start.centerX, y: start.centerY + verticalDistance * 0.35 }
    const controlTwo = { x: end.centerX, y: end.centerY - verticalDistance * 0.35 }
    const segments = Math.max(32, Math.ceil(CAREER_PATH_THICKNESS * 1.5))
    for (let step = 0; step <= segments; step += 1) points.push(cubicPoint({ x: start.centerX, y: start.centerY }, controlOne, controlTwo, { x: end.centerX, y: end.centerY }, step / segments))
  }
  points.push({ x: chapters.at(-1)!.centerX, y: -overscan })
  drawDashedPolyline(graphics, points, color)
}

function drawRoundedPolygon(graphics: Graphics, points: readonly Point[], radius: number) {
  const edgeLengths = points.map((point, index) => Math.hypot(point.x - points[(index + 1) % points.length]!.x, point.y - points[(index + 1) % points.length]!.y))
  const effectiveRadius = Math.max(0, Math.min(radius, ...edgeLengths.map((length) => Math.max(0, length / 2 - 0.1))))
  const before = (index: number) => {
    const previous = points[(index - 1 + points.length) % points.length]!
    const current = points[index]!
    const length = Math.hypot(previous.x - current.x, previous.y - current.y)
    return { x: current.x + (previous.x - current.x) * effectiveRadius / length, y: current.y + (previous.y - current.y) * effectiveRadius / length }
  }
  const after = (index: number) => {
    const next = points[(index + 1) % points.length]!
    const current = points[index]!
    const length = Math.hypot(next.x - current.x, next.y - current.y)
    return { x: current.x + (next.x - current.x) * effectiveRadius / length, y: current.y + (next.y - current.y) * effectiveRadius / length }
  }
  const first = after(0)
  graphics.moveTo(first.x, first.y)
  for (let index = 1; index <= points.length; index += 1) {
    const currentIndex = index % points.length
    const incoming = before(currentIndex)
    const corner = points[currentIndex]!
    const outgoing = after(currentIndex)
    graphics.lineTo(incoming.x, incoming.y).quadraticCurveTo(corner.x, corner.y, outgoing.x, outgoing.y)
  }
}

function drawIsometricTile(graphics: Graphics, centerX: number, centerY: number, tileWidth: number, tileHeight: number, outlineColor: number, topColor: number) {
  const top = { x: centerX, y: centerY - tileHeight / 2 }
  const right = { x: centerX + tileWidth / 2, y: centerY }
  const bottom = { x: centerX, y: centerY + tileHeight / 2 }
  const left = { x: centerX - tileWidth / 2, y: centerY }
  drawRoundedPolygon(graphics, [top, right, bottom, left], CAREER_TILE_CORNER_RADIUS)
  graphics.fill(topColor).stroke({ color: outlineColor, width: 1.5 })
}

function drawTopSeparator(graphics: Graphics, width: number, tileWidth: number, tileHeight: number, outlineColor: number, topColor: number): Point[] {
  const centerY = tileHeight / 2
  const centers = Array.from({ length: Math.ceil(width / tileWidth) + 3 }, (_, index) => -tileWidth / 2 + index * tileWidth)
  for (const centerX of centers) drawIsometricTile(graphics, centerX, centerY, tileWidth, tileHeight, outlineColor, topColor)
  return centers.flatMap((centerX) => [
    { x: centerX - tileWidth / 2, y: centerY },
    { x: centerX, y: centerY + tileHeight / 2 },
  ]).concat({ x: centers.at(-1)! + tileWidth / 2, y: centerY })
}

function drawDecorativeTiles(graphics: Graphics, chapters: ReturnType<typeof createCareerMapLayout>['chapters'], mapWidth: number, mapHeight: number, tileWidth: number, tileHeight: number, outlineColor: number, topColor: number) {
  const random = createSeededRandom(0x4e4f4b4f)
  const decorationWidth = tileWidth * CAREER_DECORATION_TILE_SCALE
  const decorationHeight = tileHeight * CAREER_DECORATION_TILE_SCALE
  const occupied = chapters.flatMap((chapter) => chapter.cells.map((cell) => ({
    x: chapter.centerX + (cell.x - cell.y) * tileWidth * chapter.chapter.size / 2,
    y: chapter.centerY + (cell.x + cell.y) * tileHeight * chapter.chapter.size / 2,
  })))
  const placed: Point[] = []
  const collides = (candidate: Point, other: Point) => Math.abs(candidate.x - other.x) < (decorationWidth + tileWidth) / 2 && Math.abs(candidate.y - other.y) < (decorationHeight + tileHeight) / 2

  for (let attempt = 0; attempt < CAREER_DECORATION_TILE_COUNT * 30 && placed.length < CAREER_DECORATION_TILE_COUNT; attempt += 1) {
    const candidate = {
      x: decorationWidth / 2 + random() * (mapWidth - decorationWidth),
      y: decorationHeight / 2 + random() * (mapHeight - decorationHeight),
    }
    if (occupied.some((tile) => collides(candidate, tile)) || placed.some((tile) => collides(candidate, tile))) continue
    placed.push(candidate)
    drawIsometricTile(graphics, candidate.x, candidate.y, decorationWidth, decorationHeight, outlineColor, darken(topColor, 34))
  }
}

export function CareerMapCanvas({ chapters = CAREER_CHAPTERS }: { chapters?: readonly CareerChapter[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [startupFailed, setStartupFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const app = new Application()
    const scene = new Container()
    const scrollMask = new Graphics()
    const separator = new Graphics()
    let host: PixiCanvasHost | undefined
    let mapHeight = 0
    let scrollY = 0
    let dragStart: { pointerId: number; screenY: number; scrollY: number } | null = null
    let detachInput: (() => void) | undefined
    let hasInitialPosition = false

    function constrainScroll(next: number): number {
      return Math.max(app.screen.height - mapHeight, Math.min(0, next))
    }

    function setScroll(next: number) {
      scrollY = constrainScroll(next)
      scene.y = scrollY
    }

    function draw() {
      const width = app.screen.width
      const height = app.screen.height
      if (width <= 0 || height <= 0) return
      scene.removeChildren().forEach((child) => child.destroy({ children: true }))
      const outlineColor = GAME_COLORS.cellBorder
      const topColor = GAME_COLORS.cellFill
      mapHeight = height + Math.max(240, chapters.length * 110)
      const layout = createCareerMapLayout(chapters, width, mapHeight)
      setScroll(hasInitialPosition ? scrollY : height - mapHeight)
      hasInitialPosition = true
      separator.clear()
      const separatorEdge = drawTopSeparator(separator, width, layout.tileWidth, layout.tileHeight, outlineColor, topColor)
      scrollMask.clear()
        .poly([...separatorEdge.flatMap((point) => [point.x, point.y]), width, height, 0, height])
        .fill(0xffffff)
      const decorationLayer = new Graphics()
      drawDecorativeTiles(decorationLayer, layout.chapters, width, mapHeight, layout.tileWidth, layout.tileHeight, outlineColor, topColor)
      scene.addChild(decorationLayer)
      const pathLayer = new Graphics()
      drawCareerPath(pathLayer, layout.chapters, mapHeight, outlineColor)
      scene.addChild(pathLayer)

      for (const item of [...layout.chapters].reverse()) {
        const tilePitchWidth = layout.tileWidth * item.chapter.size
        const tilePitchHeight = layout.tileHeight * item.chapter.size
        const tileWidth = Math.max(1, tilePitchWidth - CAREER_PLATFORM_TILE_GAP)
        const tileHeight = Math.max(1, tilePitchHeight - CAREER_PLATFORM_TILE_GAP / 2)
        const cellCenters = item.cells.map((cell) => ({
          x: item.centerX + (cell.x - cell.y) * tilePitchWidth / 2,
          y: item.centerY + (cell.x + cell.y) * tilePitchHeight / 2,
        }))
        const platform = new Graphics()

        // Gaps make every square a separate block, so each needs both visible
        // side faces rather than sharing the old Nokomino slab sides.
        const tiles = [...cellCenters].sort((first, second) => first.y - second.y || first.x - second.x)
        for (const cell of tiles) drawIsometricTile(platform, cell.x, cell.y, tileWidth, tileHeight, outlineColor, topColor)
        scene.addChild(platform)
      }
    }

    host = new PixiCanvasHost({
      app,
      canvasClassName: 'size-full',
      container,
      init: { backgroundAlpha: 0, antialias: true },
      onDestroy: () => {
        scene.destroy({ children: true })
        scrollMask.destroy()
        separator.destroy()
      },
      onError: () => setStartupFailed(true),
      onReady: () => {
        app.canvas.style.touchAction = 'none'
        scene.mask = scrollMask
        app.stage.addChild(scene, scrollMask, separator)
        draw()

        const onPointerDown = (event: PointerEvent) => {
          dragStart = { pointerId: event.pointerId, screenY: event.clientY, scrollY }
          app.canvas.setPointerCapture(event.pointerId)
        }
        const onPointerMove = (event: PointerEvent) => {
          if (!dragStart || event.pointerId !== dragStart.pointerId) return
          setScroll(dragStart.scrollY + event.clientY - dragStart.screenY)
        }
        const onPointerEnd = (event: PointerEvent) => {
          if (!dragStart || event.pointerId !== dragStart.pointerId) return
          if (app.canvas.hasPointerCapture(event.pointerId)) app.canvas.releasePointerCapture(event.pointerId)
          dragStart = null
        }
        const onWheel = (event: WheelEvent) => {
          event.preventDefault()
          setScroll(scrollY - event.deltaY)
        }
        app.canvas.addEventListener('pointerdown', onPointerDown)
        app.canvas.addEventListener('pointermove', onPointerMove)
        app.canvas.addEventListener('pointerup', onPointerEnd)
        app.canvas.addEventListener('pointercancel', onPointerEnd)
        app.canvas.addEventListener('wheel', onWheel, { passive: false })
        detachInput = () => {
          app.canvas.removeEventListener('pointerdown', onPointerDown)
          app.canvas.removeEventListener('pointermove', onPointerMove)
          app.canvas.removeEventListener('pointerup', onPointerEnd)
          app.canvas.removeEventListener('pointercancel', onPointerEnd)
          app.canvas.removeEventListener('wheel', onWheel)
        }
      },
      onResize: () => draw(),
    })
    void host.start()
    return () => { detachInput?.(); host?.destroy() }
  }, [chapters])

  return <div className="relative size-full" ref={containerRef}>{startupFailed && <CanvasStartupError />}</div>
}
