import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { BonusRequirement } from '@/game/bonus'
import { createTetrominoCells } from '@/game/tetrominoes'

const BONUS_TETROMINO_CELL_SIZE_PX = 30
const BONUS_TETROMINO_CELL_GAP_PX = 1
const BONUS_TETROMINO_CELL_BORDER_WIDTH_PX = 3
const BONUS_TETROMINO_CELL_CORNER_RADIUS_PX = 2

interface BonusTetrominoProps {
  bonus: BonusRequirement
}

function BonusTetromino(props: BonusTetrominoProps) {
  const cells = createTetrominoCells(props.bonus.shape, props.bonus.rotation ?? 0)
  const width = Math.max(...cells.map((cell) => cell.x)) + 1
  const height = Math.max(...cells.map((cell) => cell.y)) + 1

  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 bg-transparent"
      style={{
        gap: BONUS_TETROMINO_CELL_GAP_PX,
        gridTemplateColumns: `repeat(${width}, ${BONUS_TETROMINO_CELL_SIZE_PX}px)`,
        gridTemplateRows: `repeat(${height}, ${BONUS_TETROMINO_CELL_SIZE_PX}px)`,
      }}
    >
      {cells.map((cell) => (
        <span
          className="border-[#773526] bg-[var(--paper)]"
          data-testid="bonus-tetromino-cell"
          key={cell.id}
          style={{
            borderRadius: BONUS_TETROMINO_CELL_CORNER_RADIUS_PX,
            borderWidth: BONUS_TETROMINO_CELL_BORDER_WIDTH_PX,
            gridColumnStart: cell.x + 1,
            gridRowStart: cell.y + 1,
            height: BONUS_TETROMINO_CELL_SIZE_PX,
            width: BONUS_TETROMINO_CELL_SIZE_PX,
          }}
        />
      ))}
    </span>
  )
}

interface BonusDialogProps {
  bonus: readonly BonusRequirement[]
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function BonusDialog(props: BonusDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog
      onOpenChange={props.onOpenChange}
      open={props.open}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[430px]"
      >
        <DialogHeader><DialogTitle>{t('bonus.title')}</DialogTitle></DialogHeader>
        <ul
          aria-label={t('bonus.title')}
          className="flex max-h-[min(360px,calc(var(--dialog-viewport-height,var(--app-height))-200px))] flex-col gap-3 overflow-y-auto overscroll-contain pr-1"
        >
          {props.bonus.map((bonus, index) => (
            <li
              className="flex min-h-12 items-center justify-center rounded-md border-2 border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 py-2"
              key={`${bonus.shape}:${bonus.rotation ?? 'any'}:${bonus.count}:${index}`}
            >
              <div className="flex items-center justify-center gap-3">
                <BonusTetromino bonus={bonus} />
                <span className="text-[24px] leading-none font-black text-[var(--canvas-foreground)]">x{bonus.count}</span>
                {bonus.rotation === undefined && <RotateCw
                  aria-label={t('bonus.anyRotation')}
                  className="size-5 text-[var(--muted-text-color)]"
                />}
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter className="grid-cols-1">
          <DialogClose asChild>
            <Button
              className="text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase"
              size="lg"
              type="button"
            >
              {t('common.close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
