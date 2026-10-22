import { useEffect, useMemo, useRef, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { VS_PLAYERS, type VsMoveHistory } from './vsLocalGame'
import { getVsMoveNotations } from './vsMoveNotation'

interface VsMoveListProps {
  history: VsMoveHistory
  onSelect: (index: number) => void
}

const MOVE_CHIP_CLASS = 'shrink-0 rounded-sm border-2 border-transparent px-2 py-1 text-[11px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--canvas-foreground)]'

export function VsMoveList({ history, onSelect }: VsMoveListProps) {
  const scrollRef = useRef<HTMLElement>(null)
  const moves = useMemo(() => getVsMoveNotations(history.positions), [history.positions])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    if (history.index === 0) {
      scroller.scrollLeft = 0
      return
    }
    const selected = scroller.querySelector<HTMLButtonElement>('[aria-current="step"]')
    if (!selected) return
    // Scroll only the move strip, never the page or the board.
    const left = selected.offsetLeft
    const right = left + selected.offsetWidth
    if (left < scroller.scrollLeft || selected.offsetWidth > scroller.clientWidth) {
      scroller.scrollLeft = left
    } else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = right - scroller.clientWidth
    }
  }, [history.index, moves])

  function selectMove(event: MouseEvent<HTMLButtonElement>) {
    onSelect(Number(event.currentTarget.dataset.historyIndex))
  }

  return (
    <nav aria-label="Move history" className="relative flex w-full min-w-0 basis-full items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1" ref={scrollRef}>
      {moves.map((move) => (
        <button
          aria-current={move.historyIndex === history.index ? 'step' : undefined}
          aria-label={`Move ${move.moveNumber}, ${VS_PLAYERS[move.player].label}: ${move.notation}`}
          className={cn(
            MOVE_CHIP_CLASS,
            move.historyIndex === history.index
              ? 'border-[var(--canvas-foreground)] bg-[var(--outline-color)] text-[var(--paper)]'
              : 'text-[var(--muted-text-color)] hover:bg-[var(--paper-muted)]',
          )}
          data-history-index={move.historyIndex}
          key={`${move.moveNumber}:${move.notation}`}
          onClick={selectMove}
          type="button"
        >
          {move.notation}
        </button>
      ))}
      {moves.length === 0 && <span aria-hidden="true" className={`${MOVE_CHIP_CLASS} invisible`}>A0A+</span>}
    </nav>
  )
}
