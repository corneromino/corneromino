import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { VS_LOCAL_BOARD_SIZES, VS_LOCAL_DEFAULT_BOARD_SIZE, type VsLocalBoardSize } from './vsLocalConfig'

interface VsLocalSetupDialogProps {
  onContinue: () => void
  onOpenChange: (open: boolean) => void
  onStart: (boardSize: VsLocalBoardSize) => void
  open: boolean
}

export function VsLocalSetupDialog(props: VsLocalSetupDialogProps) {
  const { onContinue, onOpenChange, onStart, open } = props
  const [boardSize, setBoardSize] = useState<VsLocalBoardSize>(VS_LOCAL_DEFAULT_BOARD_SIZE)

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Local VS</DialogTitle>
        </DialogHeader>
        <div className="mt-5 flex h-[48px] items-center justify-between gap-3">
          <p className="poster-kicker text-[16px] text-[var(--canvas-foreground)]">Mode</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`Mode ${boardSize} by ${boardSize}`} className="cartoon-press h-[48px] shrink-0 px-4 text-[12px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" type="button">
                <span className="-translate-y-1 inline-flex items-center gap-2">
                  {boardSize}×{boardSize}<ChevronDown aria-hidden="true" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              {VS_LOCAL_BOARD_SIZES.map((size) => (
                <DropdownMenuItem key={size} onSelect={() => setBoardSize(size)}>
                  {size}×{size}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DialogFooter>
          <Button className="cartoon-press cartoon-press--green h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => onStart(boardSize)} size="lg" type="button">
            Start
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onContinue} size="lg" type="button">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
