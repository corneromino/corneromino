import { useId, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

const FILLED_COLOR = '#F5BC6A'
const BORDER_COLOR = '#713324'
const UNFILLED_COLOR = FILLED_COLOR
const MAP_MIDDLE_SIZE_PX = 32
const MAP_SIDE_SIZE_PX = 24
const MAP_SIDE_HORIZONTAL_OFFSET_PX = 25
const MAP_SIDE_VERTICAL_OFFSET_PX = -6
const DIALOG_MIDDLE_SIZE_PX = 64
const DIALOG_SIDE_SIZE_PX = 48
const DIALOG_SIDE_HORIZONTAL_OFFSET_PX = 70
const DIALOG_SIDE_VERTICAL_OFFSET_PX = 12
const DIALOG_TOP_OFFSET_PX = -48

interface CareerStarProps {
  filled: boolean
  id: string
  size: number
  style: CSSProperties
}

function CareerStar(props: CareerStarProps) {
  const pathId = `stroke0_2299_5664-${props.id}`
  const maskId = `stroke1_2299_5664-${props.id}`
  return (
    <svg
      aria-hidden="true"
      className="absolute overflow-visible"
      fill="none"
      height={props.size * 23 / 24}
      opacity={props.filled ? 1 : 0.30}
      style={props.style}
      viewBox="0 0 24 23"
      width={props.size}
      xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <use
        fill={props.filled ? FILLED_COLOR : UNFILLED_COLOR}
        xlinkHref={`#${pathId}`}
      />
      <mask fill="black" height="23" id={maskId} maskUnits="userSpaceOnUse" width="25" x="-0.941406" y="-0.535156">
        <rect fill="white" height="23" width="25" x="-0.941406" y="-0.535156" />
        <use xlinkHref={`#${pathId}`} />
      </mask>
      <path d="M7.12037 6.93553L3.256 7.81296C2.06661 8.08302 1.59773 9.52606 2.40124 10.4436L5.01184 13.4249C5.30223 13.7565 5.44396 14.1927 5.40395 14.6317L5.04427 18.5781C4.93357 19.7927 6.1611 20.6846 7.28207 20.2039L10.9242 18.6424C11.3293 18.4687 11.7879 18.4687 12.193 18.6424L15.8351 20.2039C16.9561 20.6846 18.1836 19.7927 18.0729 18.5781L17.7132 14.6317C17.6732 14.1927 17.815 13.7565 18.1053 13.4249L20.716 10.4436C21.5195 9.52606 21.0506 8.08302 19.8612 7.81296L15.9968 6.93553C15.567 6.83793 15.1959 6.56836 14.9703 6.1897L12.9416 2.7856C12.3172 1.73788 10.7999 1.73788 10.1756 2.7856L8.14692 6.1897C7.92126 6.56836 7.55023 6.83793 7.12037 6.93553Z" mask={`url(#${maskId})`} stroke={BORDER_COLOR} strokeWidth="4" />
      <defs><path d="M10.1756 2.7856C10.7999 1.73788 12.3172 1.73788 12.9416 2.7856L14.9703 6.1897C15.1959 6.56836 15.567 6.83793 15.9968 6.93553L19.8612 7.81296C21.0506 8.08302 21.5195 9.52606 20.716 10.4436L18.1053 13.4249C17.815 13.7565 17.6732 14.1927 17.7132 14.6317L18.0729 18.5781C18.1836 19.7927 16.9561 20.6846 15.8351 20.2039L12.193 18.6424C11.7879 18.4687 11.3293 18.4687 10.9242 18.6424L7.28207 20.2039C6.1611 20.6846 4.93357 19.7927 5.04427 18.5781L5.40395 14.6317C5.44396 14.1927 5.30223 13.7565 5.01184 13.4249L2.40124 10.4436C1.59773 9.52606 2.06661 8.08302 3.256 7.81296L7.12037 6.93553C7.55023 6.83793 7.92126 6.56836 8.14692 6.1897L10.1756 2.7856Z" id={pathId} /></defs>
    </svg>
  )
}

interface CareerStarsProps {
  className?: string
  layout?: 'dialog' | 'map'
  stars: 0 | 1 | 2 | 3
  style?: CSSProperties
}

/** Three Career stars in earned order: left, right, then the larger middle star. */
export function CareerStars(props: CareerStarsProps) {
  const id = useId()
  const isMapLayout = props.layout === 'map'
  const middleSize = isMapLayout ? MAP_MIDDLE_SIZE_PX : DIALOG_MIDDLE_SIZE_PX
  const sideSize = isMapLayout ? MAP_SIDE_SIZE_PX : DIALOG_SIDE_SIZE_PX
  const layoutStyle = isMapLayout
    ? props.style
    : { left: '50%', top: DIALOG_TOP_OFFSET_PX, transform: 'translateX(-50%)', ...props.style }
  return (
    <span
      aria-hidden="true"
      className={cn('absolute pointer-events-none z-10', props.className)}
      style={layoutStyle}
    >
      <CareerStar
        filled={props.stars >= 1}
        id={`${id}-left`}
        size={sideSize}
        style={isMapLayout
                ? { left: -MAP_SIDE_HORIZONTAL_OFFSET_PX, top: MAP_SIDE_VERTICAL_OFFSET_PX, transform: 'translate(-50%, -50%)' }
                : { left: -DIALOG_SIDE_HORIZONTAL_OFFSET_PX - sideSize / 2, top: DIALOG_SIDE_VERTICAL_OFFSET_PX }}
      />
      <CareerStar
        filled={props.stars >= 2}
        id={`${id}-right`}
        size={sideSize}
        style={isMapLayout
                ? { left: MAP_SIDE_HORIZONTAL_OFFSET_PX, top: MAP_SIDE_VERTICAL_OFFSET_PX, transform: 'translate(-50%, -50%)' }
                : { left: DIALOG_SIDE_HORIZONTAL_OFFSET_PX - sideSize / 2, top: DIALOG_SIDE_VERTICAL_OFFSET_PX }} />
      <CareerStar
        filled={props.stars >= 3}
        id={`${id}-middle`}
        size={middleSize}
        style={isMapLayout
                ? { left: 0, top: -middleSize / 3, transform: 'translate(-50%, -50%)' }
                : { left: -middleSize / 2, top: 0 }}
      />
    </span>
  )
}
