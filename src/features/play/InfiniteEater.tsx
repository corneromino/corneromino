import { useEffect, useState } from 'react'
import eaterHeadEyeClosedGraphic from '@/assets/eater-head-eye-closed.svg'
import eaterHeadGraphic from '@/assets/eater-head.svg'
import eaterMouthGraphic from '@/assets/eater-mouth.svg'

export const INFINITE_EATER_WIDTH_RATIO = 1.16
const EATER_WIDTH_PERCENT = `${INFINITE_EATER_WIDTH_RATIO * 100}%`
const EATER_HEAD_HEIGHT_RATIO = 443 / 2596 * INFINITE_EATER_WIDTH_RATIO
const EATER_HEAD_BODY_START_RATIO = 100 / 443
const BOARD_HEIGHT_RATIO = 12 / 8
/** Slightly lowers the eater to reveal its mouth lip above the head. */
const LIP_REVEAL_BOARD_WIDTH_RATIO = 0.02
const LIP_REVEAL_BOARD_HEIGHT_PERCENT = LIP_REVEAL_BOARD_WIDTH_RATIO / BOARD_HEIGHT_RATIO * 100
const EATER_HEAD_TOP_PERCENT = `${(1 - EATER_HEAD_HEIGHT_RATIO * EATER_HEAD_BODY_START_RATIO / BOARD_HEIGHT_RATIO) * 100 + LIP_REVEAL_BOARD_HEIGHT_PERCENT}%`
const EATER_MOUTH_BOTTOM_PERCENT = `-${LIP_REVEAL_BOARD_HEIGHT_PERCENT}%`
const BLINK_INTERVAL_MIN_MS = 3000
const BLINK_INTERVAL_MAX_MS = 7000
const BLINK_CLOSED_MIN_MS = 100
const BLINK_CLOSED_MAX_MS = 150
const DOUBLE_BLINK_CHANCE = 0.25
const DOUBLE_BLINK_PAUSE_MS = 140

/** The space below the board needed for the head after it meets the mouth. */
export const INFINITE_EATER_HEIGHT_RATIO = EATER_HEAD_HEIGHT_RATIO * (1 - EATER_HEAD_BODY_START_RATIO) + LIP_REVEAL_BOARD_WIDTH_RATIO

interface InfiniteEaterHeadProps {
  paused: boolean
}

/** Mouth layer, placed behind the scrolling board at its lower edge. */
export function InfiniteEaterMouth() {
  return <img alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 z-0 block max-w-none -translate-x-1/2" src={eaterMouthGraphic} style={{ bottom: EATER_MOUTH_BOTTOM_PERCENT, width: EATER_WIDTH_PERCENT }} />
}

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum)
}

/** Head layer, placed over the board so its teeth cover the mouth's join. */
export function InfiniteEaterHead(props: InfiniteEaterHeadProps) {
  const [eyesClosed, setEyesClosed] = useState(false)

  useEffect(() => {
    const closedHead = new Image()
    closedHead.src = eaterHeadEyeClosedGraphic
  }, [])

  useEffect(() => {
    if (props.paused) {
      setEyesClosed(false)
      return
    }

    const timeouts = new Set<number>()
    const schedule = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(() => {
        timeouts.delete(timeout)
        callback()
      }, delay)
      timeouts.add(timeout)
    }
    const blink = (canDoubleBlink: boolean) => {
      setEyesClosed(true)
      schedule(() => {
        setEyesClosed(false)
        if (canDoubleBlink && Math.random() < DOUBLE_BLINK_CHANCE) schedule(() => blink(false), DOUBLE_BLINK_PAUSE_MS)
        else schedule(() => blink(true), randomBetween(BLINK_INTERVAL_MIN_MS, BLINK_INTERVAL_MAX_MS))
      }, randomBetween(BLINK_CLOSED_MIN_MS, BLINK_CLOSED_MAX_MS))
    }

    schedule(() => blink(true), randomBetween(BLINK_INTERVAL_MIN_MS, BLINK_INTERVAL_MAX_MS))
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout))
  }, [props.paused])

  return (
    <img
      alt=""
      aria-hidden="true"
       className="pointer-events-none absolute left-1/2 z-20 block max-w-none -translate-x-1/2"
       src={eyesClosed ? eaterHeadEyeClosedGraphic : eaterHeadGraphic}
       style={{ top: EATER_HEAD_TOP_PERCENT, width: EATER_WIDTH_PERCENT }}
    />
  );
}
