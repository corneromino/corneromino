import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'

export const CLASSIC_INFINITE_HEALTH_SQUARE_COUNT = 10
const LOCKED_RED = LOCKED_CELL_COLOR_HEX[4]

interface ClassicInfiniteHealthBarProps {
  /** Changes to replay all heart animations while the bar is full. */
  fullBarAnimationKey?: number
  /** Number of red hearts, filled from left to right. */
  redSquareCount: number
  /** Allows future modes to use a differently sized health bar. */
  totalSquareCount?: number
}

function PixelHeart({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" className="infinite-health-heart aspect-square w-full" shapeRendering="crispEdges" viewBox="-0.25 -0.25 7.5 7.5">
      <path
        d="M1 0H3V1H4V0H6V1H7V4H6V5H5V6H4V7H3V6H2V5H1V4H0V1H1Z"
        fill={filled ? LOCKED_RED : 'var(--paper)'}
        stroke="#773526"
        strokeWidth="0.5"
      />
    </svg>
  )
}

export function ClassicInfiniteHealthBar({ fullBarAnimationKey, redSquareCount, totalSquareCount = CLASSIC_INFINITE_HEALTH_SQUARE_COUNT }: ClassicInfiniteHealthBarProps) {
  const squareCount = Math.max(1, Math.floor(totalSquareCount))
  const redCount = Math.min(squareCount, Math.max(0, Math.floor(redSquareCount)))
  const fullBarAnimation = redCount === squareCount ? fullBarAnimationKey ?? 0 : 0

  return (
    <div aria-label={`${redCount} of ${squareCount} health`} className="w-full" role="img">
      <div className="grid w-full max-w-[500px] gap-px" style={{ gridTemplateColumns: `repeat(${squareCount}, minmax(0, 1fr))` }}>
        {Array.from({ length: squareCount }, (_, index) => {
          const filled = index < redCount
          // Re-mount only a heart whose state changed, so the animation does
          // not replay for the rest of the health bar.
          return <PixelHeart filled={filled} key={`${index}:${filled}:${fullBarAnimation}`} />
        })}
      </div>
    </div>
  )
}
