import { useEffect, useRef } from 'react'

const CORNER_TRANSFORM_CLASSES = [
  'translate-x-0 translate-y-0',
  'translate-x-[72%] translate-y-0',
  'translate-x-[72%] translate-y-[72%]',
  'translate-x-0 translate-y-[72%]',
]

const CORNER_CHANGE_INTERVAL_MIN_MS = 500
const CORNER_CHANGE_INTERVAL_MAX_MS = 1_500
const CORNER_MOVE_DURATION_MS = 200
const CELLS_PER_FRAME = 10

const MENU_BACKGROUND_CELLS = Array.from({ length: 112 }, (_, index) => ({
  cornerIndex: Math.floor(Math.random() * CORNER_TRANSFORM_CLASSES.length),
  hasTetrominoCell: Math.random() > 0.48,
  id: index,
}))
const ANIMATED_CELLS = MENU_BACKGROUND_CELLS.filter((cell) => cell.hasTetrominoCell)

function getCornerChangeInterval() {
  return CORNER_CHANGE_INTERVAL_MIN_MS + Math.floor(Math.random() * (CORNER_CHANGE_INTERVAL_MAX_MS - CORNER_CHANGE_INTERVAL_MIN_MS))
}

export function TetrominoBackground() {
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    let animationFrame = 0
    const now = performance.now()
    const cells = ANIMATED_CELLS.map((cell) => ({
      cornerIndex: cell.cornerIndex,
      marker: markerRefs.current[cell.id],
      nextChangeTime: now + getCornerChangeInterval(),
    }))

    function updateBackground(frameTime: number) {
      // A partial shuffle samples distinct markers without scanning the grid.
      for (let index = 0; index < Math.min(CELLS_PER_FRAME, cells.length); index += 1) {
        const randomIndex = index + Math.floor(Math.random() * (cells.length - index))
        ;[cells[index], cells[randomIndex]] = [cells[randomIndex]!, cells[index]!]
        const cell = cells[index]!
        if (frameTime < cell.nextChangeTime) continue
        const previousCorner = cell.cornerIndex
        cell.cornerIndex = (cell.cornerIndex + 1) % CORNER_TRANSFORM_CLASSES.length
        cell.marker?.classList.remove(...CORNER_TRANSFORM_CLASSES[previousCorner].split(' '))
        cell.marker?.classList.add(...CORNER_TRANSFORM_CLASSES[cell.cornerIndex].split(' '))
        // Reset from this frame instead of catching up, avoiding a burst of
        // updates after a backgrounded tab resumes.
        cell.nextChangeTime = frameTime + getCornerChangeInterval()
      }
      animationFrame = window.requestAnimationFrame(updateBackground)
    }

    animationFrame = window.requestAnimationFrame(updateBackground)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 scale-120 rotate-6 grid grid-cols-8 content-start gap-1 opacity-10 sm:grid-cols-12 lg:grid-cols-16">
      {MENU_BACKGROUND_CELLS.map((cell, index) => (
        <div className="relative aspect-square" key={cell.id}>
          {cell.hasTetrominoCell && (
            <div className="relative size-full rounded-[2%] border-4 border-[#773526] bg-[var(--paper)]">
              <span
                className={`absolute left-[7%] top-[7%] z-10 w-1/2 aspect-square rounded-[10%] bg-[var(--outline-color)] transition-transform ease-in-out ${CORNER_TRANSFORM_CLASSES[cell.cornerIndex]}`}
                ref={(element) => { markerRefs.current[index] = element }}
                style={{ transitionDuration: `${CORNER_MOVE_DURATION_MS}ms` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
