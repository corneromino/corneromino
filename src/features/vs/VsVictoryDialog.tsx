import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PixelTrophyIcon } from '@/features/cascade/PixelTrophyIcon'
import { useTranslation } from 'react-i18next'
import { VS_PLAYERS, type VsGameResult } from './vsLocalGame'

interface VsVictoryDialogProps {
  onNewGame: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  result: VsGameResult
}

export function VsVictoryDialog({ onNewGame, onOpenChange, open, result }: VsVictoryDialogProps) {
  const { t } = useTranslation()
  const winner = result.winner === null ? null : VS_PLAYERS[result.winner]
  const resultKey: Record<VsGameResult['reason'], 'combination' | 'consecutive' | 'trap' | 'noLegalMoves'> = {
    combination: 'combination',
    'consecutive-turns': 'consecutive',
    trap: 'trap',
    'no-legal-moves': 'noLegalMoves',
  }
  const label = result.reason === 'trap' && !winner
    ? t('versusGame.trapDraw')
    : t(`versusGame.${resultKey[result.reason]}`)
  const playerLabel = winner ? t('versusGame.player', { number: winner.id + 1 }) : null
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-[390px]">
        <DialogHeader>
          {winner && (
            <div className="mx-auto mb-4 w-fit" style={{ color: winner.bannerBorder }}>
              <PixelTrophyIcon />
            </div>
          )}
          <DialogTitle>{winner ? t('versusGame.playerWins', { player: playerLabel }) : t('versusGame.draw')}</DialogTitle>
          <DialogDescription className="mt-2">{label}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className="cartoon-press cartoon-press--green h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase"
            onClick={onNewGame}
            size="lg"
            type="button"
          >
            {t('versusGame.newMatch')}
          </Button>
          <DialogClose asChild>
            <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
              {t('versusGame.viewBoard')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
