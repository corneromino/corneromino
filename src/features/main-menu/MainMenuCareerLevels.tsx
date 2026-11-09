import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DepthButton, PAPER_DEPTH_SHADOW_COLOR } from '@/components/ui/depth-surface'
import { PixelLockIcon } from '@/features/cascade/PixelLockIcon'
import { loadCompletedCareerLevelSeeds } from '@/lib/db'
import { getCareerLevelPath, getUnlockedCareerLevelSeeds, resolveCareerLevelPositions, type CareerLevelEdge, type CareerLevelPosition } from '@/features/play/careerLevels'

const LEVEL_Y_OFFSET = 300
const LEVEL_CARD_SIZE_PX = 70
const LEVEL_VIEWPORT_MASK = 'linear-gradient(to bottom, transparent 5%, black 35%, black 60%, transparent)'
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

function getCardLeft(level: CareerLevelPosition, width: number) {
  return width / 2 + level.x - LEVEL_CARD_SIZE_PX / 2
}

function getEdgeCenter(level: CareerLevelPosition, edge: CareerLevelEdge, size: CanvasSize): Point {
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

function getConnectorPath(level: CareerLevelPosition, nextLevel: CareerLevelPosition, size: CanvasSize) {
  if (!level.level.from || !level.level.to) return null

  const start = getEdgeCenter(level, level.level.from, size)
  const end = getEdgeCenter(nextLevel, level.level.to, size)
  const startNormal = EDGE_NORMALS[level.level.from]
  const endNormal = EDGE_NORMALS[level.level.to]
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

function LockedLevelBadge({ position }: { position: Point }) {
  return (
    <span
      aria-hidden="true"
      className="absolute z-10 flex size-8 items-center justify-center rounded-[9px] bg-[var(--canvas-foreground)] text-[var(--paper)] after:absolute after:-bottom-1 after:left-1/2 after:size-3 after:-translate-x-1/2 after:rotate-45 after:bg-[var(--canvas-foreground)] after:content-[''] [&>svg]:relative [&>svg]:z-10 [&>svg]:size-4"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}>
      <PixelLockIcon />
    </span>
  )
}

/** Positions authored Career level cards and their orthogonal connectors. */
export function MainMenuCareerLevels() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const viewportRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<number, HTMLDivElement>())
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ height: 0, width: 0 })
  const [completedLevelSeeds, setCompletedLevelSeeds] = useState<ReadonlySet<string>>(() => new Set())
  const [lockPositions, setLockPositions] = useState<Map<number, Point>>(() => new Map())
  const levelPositions = resolveCareerLevelPositions()
  const unlockedLevelSeeds = getUnlockedCareerLevelSeeds(completedLevelSeeds)
  const lastUnlockedLevelIndex = Math.max(0, levelPositions.reduce((lastIndex, { level }, index) => (
    level.data && unlockedLevelSeeds.has(level.data.seed) ? index : lastIndex
  ), -1))
  const highestLevelY = Math.max(0, ...levelPositions.map((level) => level.y)) + LEVEL_Y_OFFSET * 2
  const canvasHeight = highestLevelY + LEVEL_CARD_SIZE_PX

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight
  }, [])

  useEffect(() => {
    let active = true
    void loadCompletedCareerLevelSeeds(levelPositions.flatMap(({ level }) => level.data ? [level.data.seed] : []))
      .then((completedSeeds) => {
        if (active) setCompletedLevelSeeds(completedSeeds)
      })
      .catch(() => {
        // Career progression remains usable from its initial state if persistence is unavailable.
      })
    return () => {
      active = false
    }
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

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const measure = () => {
      const canvasBounds = canvas.getBoundingClientRect()
      const nextPositions = new Map<number, Point>()
      for (const [index, card] of cardRefs.current) {
        if (index <= lastUnlockedLevelIndex) continue
        const bounds = card.getBoundingClientRect()
        nextPositions.set(index, { x: bounds.left - canvasBounds.left + bounds.width / 2, y: bounds.top - canvasBounds.top })
      }
      setLockPositions(nextPositions)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    for (const card of cardRefs.current.values()) observer.observe(card)
    return () => observer.disconnect()
  }, [lastUnlockedLevelIndex, levelPositions.length])

  return (
    <div className="min-h-0 w-full flex-1">
      <section
        aria-label={t('classic.career')}
        className="scrollbar-hidden absolute inset-0 z-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-none"
        ref={viewportRef}
        style={{ maskImage: LEVEL_VIEWPORT_MASK, WebkitMaskImage: LEVEL_VIEWPORT_MASK }}
      >
        <div className="relative min-h-full" ref={canvasRef} style={{ height: canvasHeight }}>
        {canvasSize.width > 0 && canvasSize.height > 0 && <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" focusable="false" preserveAspectRatio="none" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}>
          {levelPositions.slice(0, -1).map((level, index) => {
            const path = getConnectorPath(level, levelPositions[index + 1]!, canvasSize)
            if (!path) return null
            return <g key={`${level.level.data?.seed ?? index}:${level.level.from}:${level.level.to}`}>
              <path d={path} fill="none" stroke={PAPER_DEPTH_SHADOW_COLOR} strokeLinecap="round" strokeLinejoin="round" strokeWidth={CONNECTOR_THICKNESS_PX} transform="translate(0 3)" />
              <path d={path} fill="none" stroke="var(--outline-color)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={CONNECTOR_THICKNESS_PX} />
              <path d={path} fill="none" stroke="var(--paper)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={CONNECTOR_INTERIOR_THICKNESS_PX} />
            </g>
          })}
        </svg>}
        {levelPositions.map((position, index) => {
          const { level } = position
          const data = level.data
          const isLocked = index > lastUnlockedLevelIndex
          const number = index + 1
          return (
            <div
              className="absolute z-10"
              key={data?.seed ?? `${position.x}:${position.y}:${index}`}
              ref={(element) => {
                if (element) cardRefs.current.set(index, element)
                else cardRefs.current.delete(index)
              }}
              style={{
                bottom: position.y + LEVEL_Y_OFFSET,
                height: LEVEL_CARD_SIZE_PX,
                left: `calc(50% + ${position.x}px)`,
                transform: 'translateX(-50%)',
                width: LEVEL_CARD_SIZE_PX,
              }}
            >
              <DepthButton
                aria-label={isLocked ? `${t('career.level', { number })} (${t('common.locked')})` : t('career.level', { number })}
                borderWidth={CONNECTOR_BORDER_THICKNESS_PX}
                className="size-full text-[25px] font-black text-[var(--canvas-foreground)] disabled:!opacity-100"
                color={level.bgColor}
                depth={4}
                disabled={isLocked || !data}
                onClick={data && !isLocked ? () => navigate(getCareerLevelPath({ ...level, data })) : undefined}
                radius={20}
                shadowColor={level.bgColor ? undefined : PAPER_DEPTH_SHADOW_COLOR}
                title={t('career.level', { number })}
                yPadding={0}
              >
                {number}
              </DepthButton>
            </div>
          )
        })}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
          {[...lockPositions.entries()].map(([index, position]) => <LockedLevelBadge key={index} position={position} />)}
        </div>
        </div>
      </section>
    </div>
  )
}
