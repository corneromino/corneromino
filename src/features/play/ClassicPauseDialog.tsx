import { Copy, LogOut, Play, RotateCcw, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ClassicPauseDialogProps {
  gameMode: string
  isCareerLevel?: boolean
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onQuitWithoutSaving: () => void
  onRestart: () => void
  onResume: () => void
  onSaveAndQuit: () => void
  open: boolean
  seed: string
}

export function ClassicPauseDialog(props: ClassicPauseDialogProps) {
  const { gameMode, isCareerLevel = false, isSaving, onOpenChange, onQuitWithoutSaving, onRestart, onResume, onSaveAndQuit, open, seed } = props
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('classic.paused')}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="grid-cols-1">
          <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onResume} size="lg" type="button">
            <Play aria-hidden="true" /> {t('common.resume')}
          </Button>
          <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onRestart} size="lg" type="button">
            <RotateCcw aria-hidden="true" /> {t('common.restart')}
          </Button>
          {!isCareerLevel && <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={() => void navigator.clipboard.writeText(`${gameMode}:${seed}`)} size="lg" type="button">
            <Copy aria-hidden="true" /> {t('classic.copySeed')}
          </Button>}
          <div className={isCareerLevel ? undefined : 'mt-3 grid gap-2'}>
            {!isCareerLevel && <DialogDescription className="text-center text-[18px]">{t('classic.savePrompt')}</DialogDescription>}
            <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onSaveAndQuit} size="lg" type="button">
              <Save aria-hidden="true" /> {t('common.saveAndQuit')}
            </Button>
            {!isCareerLevel && <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onQuitWithoutSaving} size="lg" type="button">
              <LogOut aria-hidden="true" /> {t('common.quitWithoutSaving')}
            </Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
