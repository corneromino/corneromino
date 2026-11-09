import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DepthButton, PAPER_DEPTH_SHADOW_COLOR } from '@/components/ui/depth-surface'
import { careerLevels, getCareerLevelPath, type CareerLevel, type CareerLevelEdge } from '@/features/play/careerLevels'

const LEVEL_Y_OFFSET = 50
const LEVEL_CARD_SIZE_PX = 70
const LEVEL_VIEWPORT_MASK = 'linear-gradient(to bottom, transparent, black 25%, black 88%, transparent)'
const CONNECTOR_TURN_RADIUS_PX = 20
const CONNECTOR_THICKNESS_PX = 25
const CONNECTOR_BORDER_THICKNESS_PX = 4
const CONNECTOR_INTERIOR_THICKNESS_PX = CONNECTOR_THICKNESS_PX - CONNECTOR_BORDER_THICKNESS_PX * 2
const CONNECTOR_MIN_SEGMENT_PX = 1

interface Point {
  x: number
  y: number
}

interface CanvasSize {
  height: number
  width: number
}

const EDGE_NORMALS: Record<CareerLevelEdge, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function getCardLeft(level: CareerLevel, width: number) {
  const x = Math.max(-1, Math.min(1, level.x))
  const offset = (x + 1) * 50
  return width * offset / 100 - LEVEL_CARD_SIZE_PX * offset / 100
}

function getEdgeCenter(level: CareerLevel, edge: CareerLevelEdge, size: CanvasSize): Point {
  const left = getCardLeft(level, size.width)
  const top = size.height - level.y - LEVEL_Y_OFFSET - LEVEL_CARD_SIZE_PX
  switch (edge) {
    case 'top': return { x: left + LEVEL_CARD_SIZE_PX / 2, y: top }
    case 'bottom': return { x: left + LEVEL_CARD_SIZE_PX / 2, y: top + LEVEL_CARD_SIZE_PX }
    case 'left': return { x: left, y: top + LEVEL_CARD_SIZE_PX / 2 }
    case 'right': return { x: left + LEVEL_CARD_SIZE_PX, y: top + LEVEL_CARD_SIZE_PX / 2 }
  }
}

function translate(point: Point, direction: Point, distance: number): Point {
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance }
}

function dot(first: Point, second: Point) {
  return first.x * second.x + first.y * second.y
}

function isForward(start: Point, end: Point, direction: Point) {
  return dot({ x: end.x - start.x, y: end.y - start.y }, direction) >= CONNECTOR_MIN_SEGMENT_PX
}

function hasSameAxis(first: Point, second: Point) {
  return first.x === 0 ? second.x === 0 : second.x !== 0
}

function selectLane(lower: number, upper: number) {
  if (Number.isFinite(lower) && Number.isFinite(upper)) return (lower + upper) / 2
  if (Number.isFinite(lower)) return lower + CONNECTOR_TURN_RADIUS_PX
  return upper - CONNECTOR_TURN_RADIUS_PX
}

function sameAxis(first: Point, middle: Point, last: Point) {
  return (first.x === middle.x && middle.x === last.x) || (first.y === middle.y && middle.y === last.y)
}

function roundedOrthogonalPath(points: readonly Point[]) {
  const compacted = points.filter((point, index) => index === 0 || point.x !== points[index - 1]!.x || point.y !== points[index - 1]!.y)
  if (compacted.length < 2) return ''

  let path = `M ${compacted[0]!.x} ${compacted[0]!.y}`
  for (let index = 1; index < compacted.length - 1; index += 1) {
    const previous = compacted[index - 1]!
    const current = compacted[index]!
    const next = compacted[index + 1]!
    if (sameAxis(previous, current, next)) {
      path += ` L ${current.x} ${current.y}`
      continue
    }

    const previousDistance = Math.hypot(current.x - previous.x, current.y - previous.y)
    const nextDistance = Math.hypot(next.x - current.x, next.y - current.y)
    const radius = Math.min(CONNECTOR_TURN_RADIUS_PX, previousDistance / 2, nextDistance / 2)
    const before = {
      x: current.x - (current.x - previous.x) / previousDistance * radius,
      y: current.y - (current.y - previous.y) / previousDistance * radius,
    }
    const after = {
      x: current.x + (next.x - current.x) / nextDistance * radius,
      y: current.y + (next.y - current.y) / nextDistance * radius,
    }
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
  }

  const last = compacted.at(-1)!
  return `${path} L ${last.x} ${last.y}`
}

function getConnectorPath(level: CareerLevel, nextLevel: CareerLevel, size: CanvasSize) {
  if (!level.from || !level.to) return null

  const start = getEdgeCenter(level, level.from, size)
  const end = getEdgeCenter(nextLevel, level.to, size)
  const startNormal = EDGE_NORMALS[level.from]
  const endNormal = EDGE_NORMALS[level.to]
  const incomingDirection = { x: -endNormal.x, y: -endNormal.y }
  const axesMatch = hasSameAxis(startNormal, incomingDirection)

  // Prefer a straight path whenever both edge directions already agree.
  if (axesMatch && dot(startNormal, incomingDirection) === 1 && isForward(start, end, startNormal)) {
    const isAligned = startNormal.x === 0 ? start.x === end.x : start.y === end.y
    if (isAligned) return roundedOrthogonalPath([start, end])
  }

  // Perpendicular start/end directions can use a single rounded elbow.
  if (!axesMatch) {
    const bend = startNormal.x !== 0 ? { x: end.x, y: start.y } : { x: start.x, y: end.y }
    if (isForward(start, bend, startNormal) && isForward(bend, end, incomingDirection)) {
      return roundedOrthogonalPath([start, bend, end])
    }
  }

  // Matching axes need two turns at most when there is room for a middle run.
  if (axesMatch) {
    if (startNormal.x !== 0 && start.y !== end.y) {
      let lower = -Infinity
      let upper = Infinity
      if (startNormal.x > 0) lower = Math.max(lower, start.x + CONNECTOR_MIN_SEGMENT_PX)
      else upper = Math.min(upper, start.x - CONNECTOR_MIN_SEGMENT_PX)
      if (incomingDirection.x > 0) upper = Math.min(upper, end.x - CONNECTOR_MIN_SEGMENT_PX)
      else lower = Math.max(lower, end.x + CONNECTOR_MIN_SEGMENT_PX)
      if (lower < upper) return roundedOrthogonalPath([start, { x: selectLane(lower, upper), y: start.y }, { x: selectLane(lower, upper), y: end.y }, end])
    }
    if (startNormal.y !== 0 && start.x !== end.x) {
      let lower = -Infinity
      let upper = Infinity
      if (startNormal.y > 0) lower = Math.max(lower, start.y + CONNECTOR_MIN_SEGMENT_PX)
      else upper = Math.min(upper, start.y - CONNECTOR_MIN_SEGMENT_PX)
      if (incomingDirection.y > 0) upper = Math.min(upper, end.y - CONNECTOR_MIN_SEGMENT_PX)
      else lower = Math.max(lower, end.y + CONNECTOR_MIN_SEGMENT_PX)
      if (lower < upper) return roundedOrthogonalPath([start, { x: start.x, y: selectLane(lower, upper) }, { x: end.x, y: selectLane(lower, upper) }, end])
    }
  }

  // If geometry makes a lower-turn path impossible, preserve both requested
  // edge directions with the smallest deterministic fallback route.
  const startOuter = translate(start, startNormal, CONNECTOR_TURN_RADIUS_PX)
  const endOuter = translate(end, endNormal, CONNECTOR_TURN_RADIUS_PX)
  if (axesMatch) {
    if (startNormal.x !== 0) {
      const laneY = Math.min(start.y, end.y) - CONNECTOR_TURN_RADIUS_PX
      return roundedOrthogonalPath([start, startOuter, { x: startOuter.x, y: laneY }, { x: endOuter.x, y: laneY }, endOuter, end])
    }
    const laneX = Math.min(start.x, end.x) - CONNECTOR_TURN_RADIUS_PX
    return roundedOrthogonalPath([start, startOuter, { x: laneX, y: startOuter.y }, { x: laneX, y: endOuter.y }, endOuter, end])
  }

  const bend = startNormal.x !== 0
    ? { x: startOuter.x, y: endOuter.y }
    : { x: endOuter.x, y: startOuter.y }
  return roundedOrthogonalPath([start, startOuter, bend, endOuter, end])
}

/** Positions authored Career level cards and their orthogonal connectors. */
export function MainMenuCareerLevels() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const viewportRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ height: 0, width: 0 })
  const highestLevelY = Math.max(0, ...careerLevels.map((level) => level.y)) + LEVEL_Y_OFFSET * 2
  const canvasHeight = highestLevelY + LEVEL_CARD_SIZE_PX

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const measure = () => setCanvasSize({ height: canvas.clientHeight, width: canvas.clientWidth })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      aria-label={t('classic.career')}
      className="scrollbar-hidden relative min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
      ref={viewportRef}
      style={{ maskImage: LEVEL_VIEWPORT_MASK, WebkitMaskImage: LEVEL_VIEWPORT_MASK }}
    >
      <div className="relative min-h-full" ref={canvasRef} style={{ height: canvasHeight }}>
        {canvasSize.width > 0 && canvasSize.height > 0 && <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" focusable="false" preserveAspectRatio="none" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}>
          {careerLevels.slice(0, -1).map((level, index) => {
            const path = getConnectorPath(level, careerLevels[index + 1]!, canvasSize)
            if (!path) return null
            return <g key={`${level.data?.seed ?? index}:${level.from}:${level.to}`}>
              <path d={path} fill="none" stroke={PAPER_DEPTH_SHADOW_COLOR} strokeLinecap="round" strokeLinejoin="round" strokeWidth={CONNECTOR_THICKNESS_PX} transform="translate(0 3)" />
              <path d={path} fill="none" stroke="var(--outline-color)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={CONNECTOR_THICKNESS_PX} />
              <path d={path} fill="none" stroke="var(--paper)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={CONNECTOR_INTERIOR_THICKNESS_PX} />
            </g>
          })}
        </svg>}
        {careerLevels.map((level, index) => {
          const data = level.data
          const x = Math.max(-1, Math.min(1, level.x))
          const offset = (x + 1) * 50
          const number = index + 1
          return (
            <DepthButton
              aria-label={t('career.level', { number })}
              borderWidth={CONNECTOR_BORDER_THICKNESS_PX}
              className="absolute z-10 text-[25px] font-black text-[var(--canvas-foreground)]"
              color={level.bgColor}
              depth={4}
              key={data?.seed ?? `${level.x}:${level.y}:${index}`}
              onClick={data ? () => navigate(getCareerLevelPath({ ...level, data })) : undefined}
              radius={20}
              shadowColor={level.bgColor ? undefined : PAPER_DEPTH_SHADOW_COLOR}
              style={{
                bottom: level.y + LEVEL_Y_OFFSET,
                height: LEVEL_CARD_SIZE_PX,
                left: `${offset}%`,
                transform: `translateX(-${offset}%)`,
                width: LEVEL_CARD_SIZE_PX,
              }}
              title={t('career.level', { number })}
              yPadding={0}
            >
              {number}
            </DepthButton>
          )
        })}
      </div>
    </section>
  )
}
