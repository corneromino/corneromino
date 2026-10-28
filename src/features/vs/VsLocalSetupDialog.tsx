import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { VS_LOCAL_BOARD_SIZES, VS_LOCAL_DEFAULT_BOARD_SIZE, type VsLocalBoardSize } from './vsLocalConfig'

interface VsLocalSetupDialogProps {
  onContinue: () => void
  onOpenChange: (open: boolean) => void
  onStart: (boardSize: VsLocalBoardSize) => void
  open: boolean
}

export function VsLocalSetupDialog(props: VsLocalSetupDialogProps) {
  const { onContinue, onOpenChange, onStart, open } = props
  const { t } = useTranslation()
  const [boardSize, setBoardSize] = useState<VsLocalBoardSize>(VS_LOCAL_DEFAULT_BOARD_SIZE)

  function changeBoardSize(value: string) {
    const size = VS_LOCAL_BOARD_SIZES.find((size) => String(size) === value)
    if (size !== undefined) setBoardSize(size)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('versus.localVs')}</DialogTitle>
        </DialogHeader>
        <div className="mt-5 flex h-[48px] items-center justify-between gap-3">
          <p className="poster-kicker text-[16px] text-[var(--canvas-foreground)]">{t('versusGame.mode')}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={t('versusGame.boardSize', { size: boardSize })} className="cartoon-press h-[48px] shrink-0 px-4 text-[12px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" type="button">
                <span className="-translate-y-1 inline-flex items-center gap-2">
                  {boardSize}×{boardSize}<ChevronDown aria-hidden="true" className="dropdown-menu-chevron" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup onValueChange={changeBoardSize} value={String(boardSize)}>
                {VS_LOCAL_BOARD_SIZES.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)}>
                    {size}×{size}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DialogFooter>
          <Button className="cartoon-press cartoon-press--green h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => onStart(boardSize)} size="lg" type="button">
            {t('versusGame.start')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onContinue} size="lg" type="button">
            {t('common.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
