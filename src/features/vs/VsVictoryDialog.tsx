import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PixelTrophyIcon } from '@/features/cascade/PixelTrophyIcon'
import { VS_PLAYERS, type VsGameResult } from './vsLocalGame'

const RESULT_LABELS: Record<VsGameResult['reason'], string> = {
  combination: 'Combination win',
  'consecutive-turns': 'Consecutive win',
  trap: 'Trap win',
  'no-legal-moves': 'No legal moves',
}

interface VsVictoryDialogProps {
  onNewGame: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  result: VsGameResult
}

export function VsVictoryDialog({ onNewGame, onOpenChange, open, result }: VsVictoryDialogProps) {
  const winner = result.winner === null ? null : VS_PLAYERS[result.winner]
  const label = result.reason === 'trap' && !winner ? 'Trap draw' : RESULT_LABELS[result.reason]
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-[390px]">
        <DialogHeader>
          {winner && (
            <div className="mx-auto mb-4 w-fit" style={{ color: winner.bannerBorder }}>
              <PixelTrophyIcon />
            </div>
          )}
          <DialogTitle>{winner ? `${winner.label} wins!` : 'Draw'}</DialogTitle>
          <DialogDescription className="mt-2">{label}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className="cartoon-press cartoon-press--green h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase"
            onClick={onNewGame}
            size="lg"
            type="button"
          >
            New match
          </Button>
          <DialogClose asChild>
            <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
              View board
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
