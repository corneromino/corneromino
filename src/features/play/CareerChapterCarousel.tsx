import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CareerChapter } from './CareerChapter'
import { CAREER_PATH_DASH_GAP_PX, CAREER_PATH_DASH_LENGTH_PX, CAREER_PATH_THICKNESS_PX, type CareerChapter as Chapter } from './careerChapters'

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
  const helpId = useId()
  const reduceMotion = useReducedMotion() === true
  const decorativePath = useMemo(() => createDecorativePath(chapters.length), [chapters.length])

  function setChapter(next: number, behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth') {
    const target = Math.max(0, Math.min(chapters.length - 1, next))
    indexRef.current = target
    setIndex(target)
    const viewport = viewportRef.current
    viewport?.scrollTo?.({ behavior, left: target * viewport.clientWidth })
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observedViewport = viewport

    function measure() {
      observedViewport.scrollLeft = indexRef.current * observedViewport.clientWidth
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(observedViewport)
    return () => observer.disconnect()
  }, [])

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const viewport = event.currentTarget
    if (viewport.clientWidth === 0) return
    const next = Math.max(0, Math.min(chapters.length - 1, Math.round(viewport.scrollLeft / viewport.clientWidth)))
    if (next !== indexRef.current) {
      indexRef.current = next
      setIndex(next)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1 : indexRef.current + (event.key === 'ArrowRight' ? 1 : -1)
    setChapter(next)
  }

  const current = chapters[index]
  return (
    <div
      aria-describedby={helpId}
      aria-label={t('classic.career')}
      aria-roledescription={t('career.carousel')}
      className="relative z-10 -mx-5 flex min-h-0 w-[calc(100%+2.5rem)] flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:rounded-[var(--ios-radius)] focus-visible:outline-2 focus-visible:outline-[var(--outline-color)] focus-visible:outline-offset-[-2px]"
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      ref={viewportRef}
      role="region"
      tabIndex={0}
    >
        <p className="sr-only" id={helpId}>{t('career.navigationHint')}</p>
        <div className="relative flex h-full shrink-0" style={{ width: `${chapters.length * 100}%` }}>
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
            <div aria-hidden={chapterIndex !== index} className="relative z-10 h-full min-w-0 shrink-0 snap-start" inert={chapterIndex !== index} key={chapter.id} style={{ width: `${100 / chapters.length}%` }}>
              <CareerChapter chapter={chapter} number={chapterIndex + 1} startLevel={chapterIndex * 4 + 1} />
            </div>
          ))}
        </div>
        <p aria-atomic="true" aria-live="polite" className="sr-only">
          {current && t('career.position', {
            number: index + 1,
            total: chapters.length,
            title: t(`career.chapters.${current.id}`, { defaultValue: current.title }),
          })}
        </p>
    </div>
  )
}
