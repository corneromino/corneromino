import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { animate, domAnimation, LazyMotion, m, useMotionValue, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CareerChapter } from './CareerChapter'
import { CAREER_PATH_DASH_GAP_PX, CAREER_PATH_DASH_LENGTH_PX, CAREER_PATH_THICKNESS_PX, type CareerChapter as Chapter } from './careerChapters'

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  startTime: number
  originX: number
  axis: 'x' | 'y' | null
}

const CAREER_PATH_HEIGHT = 1_000
const CAREER_PATH_CHAPTER_WIDTH = 1_000
const CAREER_PATH_SEGMENT_WIDTH = 450
const CAREER_PATH_TENSION = 1.2

function createDecorativePath(chapterCount: number) {
  const width = chapterCount * CAREER_PATH_CHAPTER_WIDTH
  const startX = -80
  const endX = width + 80
  const segmentCount = Math.max(1, Math.ceil((endX - startX) / CAREER_PATH_SEGMENT_WIDTH))
  let seed = 0x6d2b79f5
  const random = () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
  // This sequence is derived from the supplied route's broad crests, lower
  // sweep, and leftward return. It repeats at a fixed physical width, so new
  // chapters extend the route rather than stretching its existing curves.
  const routeHeights = [700, 240, 520, 130, 290, 680, 820, 340, 200, 520, 700]
  const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
    const isEndpoint = index === 0 || index === segmentCount
    const routeIndex = index % (routeHeights.length - 1)
    const isBacktrack = routeIndex === 5
    const baseX = index === segmentCount ? endX : startX + index * CAREER_PATH_SEGMENT_WIDTH
    const xJitter = isEndpoint ? 0 : (random() - 0.5) * 30
    const yJitter = isEndpoint ? 0 : (random() - 0.5) * 30
    return {
      x: baseX - (isBacktrack ? CAREER_PATH_SEGMENT_WIDTH * 1.35 : 0) + xJitter,
      y: Math.max(70, Math.min(CAREER_PATH_HEIGHT - 70, routeHeights[routeIndex] + yJitter)),
    }
  })

  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)]
    const start = points[index]
    const end = points[index + 1]
    const next = points[Math.min(points.length - 1, index + 2)]
    const control1X = start.x + (end.x - previous.x) * CAREER_PATH_TENSION / 6
    const control1Y = start.y + (end.y - previous.y) * CAREER_PATH_TENSION / 6
    const control2X = end.x - (next.x - start.x) * CAREER_PATH_TENSION / 6
    const control2Y = end.y - (next.y - start.y) * CAREER_PATH_TENSION / 6
    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${end.x} ${end.y}`
  }

  return { path, viewBox: `0 0 ${width} ${CAREER_PATH_HEIGHT}` }
}

export function CareerChapterCarousel({ chapters }: { chapters: readonly Chapter[] }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(0)
  const gestureRef = useRef<Gesture | null>(null)
  const ignoredPointerIdRef = useRef<number | null>(null)
  const animationRef = useRef<ReturnType<typeof animate> | null>(null)
  const helpId = useId()
  const x = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  const decorativePath = useMemo(() => createDecorativePath(chapters.length), [chapters.length])
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function measure() {
      animationRef.current?.stop()
      const pointerId = gestureRef.current?.pointerId
      gestureRef.current = null
      if (pointerId !== undefined && viewport!.hasPointerCapture(pointerId)) viewport!.releasePointerCapture(pointerId)
      widthRef.current = viewport!.clientWidth
      x.set(-indexRef.current * widthRef.current)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      animationRef.current?.stop()
    }
  }, [x])

  useEffect(() => {
    // Chrome on mobile can occasionally deliver a terminal touch event outside
    // React's carousel handler after a drag. Without this fallback, pointer
    // capture survives until the next tap, swallowing that tap's target.
    function recoverStaleCapture() {
      const gesture = gestureRef.current
      const viewport = viewportRef.current
      if (!gesture || !viewport) return false
      gestureRef.current = null
      if (viewport.hasPointerCapture(gesture.pointerId)) viewport.releasePointerCapture(gesture.pointerId)
      goToChapter(indexRef.current)
      return true
    }

    function handleTerminalEvent(event: globalThis.PointerEvent) {
      const gesture = gestureRef.current
      if (gesture?.pointerId === event.pointerId) recoverStaleCapture()
    }

    function handleNewPointer(event: globalThis.PointerEvent) {
      if (!event.isPrimary || !recoverStaleCapture()) return
      // If Chrome delivered this new tap to the stale capture target, do not
      // start another carousel gesture from it. Its later click can then reach
      // the actual button below the pointer.
      if (event.composedPath().includes(viewportRef.current!)) ignoredPointerIdRef.current = event.pointerId
    }

    window.addEventListener('pointerdown', handleNewPointer, true)
    window.addEventListener('pointerup', handleTerminalEvent)
    window.addEventListener('pointercancel', handleTerminalEvent)
    return () => {
      window.removeEventListener('pointerdown', handleNewPointer, true)
      window.removeEventListener('pointerup', handleTerminalEvent)
      window.removeEventListener('pointercancel', handleTerminalEvent)
    }
  }, [reduceMotion, x])

  function goToChapter(next: number) {
    const target = Math.max(0, Math.min(chapters.length - 1, next))
    indexRef.current = target
    setIndex(target)
    animationRef.current?.stop()
    const targetX = -target * widthRef.current
    // Animate the element's transform directly, allowing Motion to delegate
    // the release animation to the browser's accelerated transform path.
    animationRef.current = trackRef.current ? animate(trackRef.current, { x: targetX }, reduceMotion
      ? { duration: 0 }
      : { type: 'spring', stiffness: 320, damping: 34 }) : animate(x, targetX, { duration: 0 })
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (ignoredPointerIdRef.current === event.pointerId) {
      ignoredPointerIdRef.current = null
      return
    }
    if (!event.isPrimary || event.button !== 0 || gestureRef.current || widthRef.current === 0) return
    animationRef.current?.stop()
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      originX: x.get(),
      axis: null,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const dx = event.clientX - gesture.startX
    const dy = event.clientY - gesture.startY
    if (gesture.axis === null && Math.hypot(dx, dy) > 6) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (gesture.axis !== 'x') return
    const position = gesture.originX + Math.max(-widthRef.current, Math.min(widthRef.current, dx))
    const minX = -(chapters.length - 1) * widthRef.current
    // A little resistance at either end, followed by a snap back on release.
    x.set(position > 0 ? position * 0.18 : position < minX ? minX + (position - minX) * 0.18 : position)
  }

  function finishGesture(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const dx = event.clientX - gesture.startX
    const velocity = dx / Math.max(1, event.timeStamp - gesture.startTime)
    const shouldAdvance = !cancelled && gesture.axis === 'x'
      && (Math.abs(dx) >= widthRef.current * 0.2 || (Math.abs(dx) > 30 && Math.abs(velocity) > 0.5))
    goToChapter(indexRef.current + (shouldAdvance ? (dx < 0 ? 1 : -1) : 0))
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) { finishGesture(event, false) }
  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) { finishGesture(event, true) }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const pointerId = gestureRef.current?.pointerId
    gestureRef.current = null
    if (pointerId !== undefined && event.currentTarget.hasPointerCapture(pointerId)) event.currentTarget.releasePointerCapture(pointerId)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1 : indexRef.current + (event.key === 'ArrowRight' ? 1 : -1)
    goToChapter(next)
  }

  const current = chapters[index]
  return (
    <LazyMotion features={domAnimation}>
      <div
        aria-describedby={helpId}
        aria-label={t('classic.career')}
        aria-roledescription={t('career.carousel')}
        className="relative z-10 -mx-5 flex min-h-0 w-[calc(100%+2.5rem)] flex-1 touch-pan-y overflow-hidden select-none cursor-grab [-webkit-tap-highlight-color:transparent] active:cursor-grabbing focus-visible:rounded-[var(--ios-radius)] focus-visible:outline-2 focus-visible:outline-[var(--outline-color)] focus-visible:outline-offset-[-2px]"
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={viewportRef}
        role="region"
        tabIndex={0}
      >
        <p className="sr-only" id={helpId}>{t('career.navigationHint')}</p>
        <m.div className="relative flex h-full shrink-0" ref={trackRef} style={{ width: `${chapters.length * 100}%`, x }}>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 size-full overflow-hidden"
            focusable="false"
            preserveAspectRatio="none"
            viewBox={decorativePath.viewBox}
          >
            <path
              d={decorativePath.path}
              fill="none"
              stroke="var(--outline-color)"
              strokeDasharray={`${CAREER_PATH_DASH_LENGTH_PX} ${CAREER_PATH_DASH_GAP_PX}`}
              strokeLinecap="round"
              strokeWidth={CAREER_PATH_THICKNESS_PX}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {chapters.map((chapter, chapterIndex) => (
            <div aria-hidden={chapterIndex !== index} className="relative z-10 h-full min-w-0 shrink-0" inert={chapterIndex !== index} key={chapter.id} style={{ width: `${100 / chapters.length}%` }}>
              <CareerChapter chapter={chapter} number={chapterIndex + 1} startLevel={chapterIndex * 4 + 1} />
            </div>
          ))}
        </m.div>
        <p aria-atomic="true" aria-live="polite" className="sr-only">
          {current && t('career.position', {
            number: index + 1,
            total: chapters.length,
            title: t(`career.chapters.${current.id}`, { defaultValue: current.title }),
          })}
        </p>
      </div>
    </LazyMotion>
  )
}
