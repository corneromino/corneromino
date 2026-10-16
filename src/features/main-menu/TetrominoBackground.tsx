import { useEffect, useRef, useState } from 'react'

const CORNER_TRANSFORM_CLASSES = [
  'translate-x-0 translate-y-0',
  'translate-x-[72%] translate-y-0',
  'translate-x-[72%] translate-y-[72%]',
  'translate-x-0 translate-y-[72%]',
]

const CORNER_CHANGE_INTERVAL_MIN_MS = 500
const CORNER_CHANGE_INTERVAL_MAX_MS = 1_500
const CORNER_MOVE_DURATION_MS = 200

const MENU_BACKGROUND_CELLS = Array.from({ length: 112 }, (_, index) => ({
  cornerIndex: Math.floor(Math.random() * CORNER_TRANSFORM_CLASSES.length),
  hasTetrominoCell: Math.random() > 0.48,
  id: index,
}))

function getCornerChangeInterval() {
  return CORNER_CHANGE_INTERVAL_MIN_MS + Math.floor(Math.random() * (CORNER_CHANGE_INTERVAL_MAX_MS - CORNER_CHANGE_INTERVAL_MIN_MS))
}

export function TetrominoBackground() {
  const [cornerIndexes, setCornerIndexes] = useState(() => MENU_BACKGROUND_CELLS.map((cell) => cell.cornerIndex))
  const nextChangeTimesRef = useRef<number[]>([])

  useEffect(() => {
    let animationFrame = 0
    const now = performance.now()
    nextChangeTimesRef.current = MENU_BACKGROUND_CELLS.map((cell) => (
      cell.hasTetrominoCell ? now + getCornerChangeInterval() : Infinity
    ))

    function updateBackground(frameTime: number) {
      const changedIndexes: number[] = []
      for (let index = 0; index < MENU_BACKGROUND_CELLS.length; index += 1) {
        if (frameTime < nextChangeTimesRef.current[index]!) continue
        changedIndexes.push(index)
        // Reset from this frame instead of catching up, avoiding a burst of
        // updates after a backgrounded tab resumes.
        nextChangeTimesRef.current[index] = frameTime + getCornerChangeInterval()
      }

      if (changedIndexes.length > 0) {
        const changed = new Set(changedIndexes)
        setCornerIndexes((indexes) => indexes.map((cornerIndex, index) => (
          changed.has(index) ? (cornerIndex + 1) % CORNER_TRANSFORM_CLASSES.length : cornerIndex
        )))
      }
      animationFrame = window.requestAnimationFrame(updateBackground)
    }

    animationFrame = window.requestAnimationFrame(updateBackground)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 scale-150 grid grid-cols-8 content-start gap-1 opacity-10 sm:grid-cols-12 lg:grid-cols-16">
      {MENU_BACKGROUND_CELLS.map((cell, index) => (
        <div className="relative aspect-square" key={cell.id}>
          {cell.hasTetrominoCell && (
            <div className="relative size-full rounded-[2%] border-4 border-[#773526] bg-[#ffd18a]">
              <span
                className={`absolute left-[7%] top-[7%] z-10 w-1/2 aspect-square rounded-[10%] bg-[var(--outline-color)] transition-transform ease-in-out ${CORNER_TRANSFORM_CLASSES[cornerIndexes[index]]}`}
                style={{ transitionDuration: `${CORNER_MOVE_DURATION_MS}ms` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
