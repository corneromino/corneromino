import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { animate, domAnimation, LazyMotion, m, useMotionValue, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CareerChapter } from './CareerChapter'
import type { CareerChapter as Chapter } from './careerChapters'

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  startTime: number
  originX: number
  axis: 'x' | 'y' | null
}

export function CareerChapterCarousel({ chapters }: { chapters: readonly Chapter[] }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(0)
  const gestureRef = useRef<Gesture | null>(null)
  const animationRef = useRef<ReturnType<typeof animate> | null>(null)
  const helpId = useId()
  const x = useMotionValue(0)
  const reduceMotion = useReducedMotion()

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

  function goToChapter(next: number) {
    const target = Math.max(0, Math.min(chapters.length - 1, next))
    indexRef.current = target
    setIndex(target)
    animationRef.current?.stop()
    animationRef.current = animate(x, -target * widthRef.current, reduceMotion
      ? { duration: 0 }
      : { type: 'spring', stiffness: 320, damping: 34 })
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
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
        className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 touch-pan-y overflow-hidden select-none cursor-grab [-webkit-tap-highlight-color:transparent] active:cursor-grabbing focus-visible:rounded-[var(--ios-radius)] focus-visible:outline-2 focus-visible:outline-[var(--outline-color)] focus-visible:outline-offset-[-2px]"
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
        <m.div className="flex size-full" style={{ x }}>
          {chapters.map((chapter, chapterIndex) => (
            <div aria-hidden={chapterIndex !== index} className="h-full min-w-0 basis-full shrink-0" inert={chapterIndex !== index} key={chapter.id}>
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
