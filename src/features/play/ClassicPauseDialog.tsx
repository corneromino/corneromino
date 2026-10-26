import { LogOut, Play, RotateCcw, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ClassicPauseDialogProps {
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onQuitWithoutSaving: () => void
  onRestart: () => void
  onResume: () => void
  onSaveAndQuit: () => void
  open: boolean
}

export function ClassicPauseDialog(props: ClassicPauseDialogProps) {
  const { isSaving, onOpenChange, onQuitWithoutSaving, onRestart, onResume, onSaveAndQuit, open } = props
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('classic.paused')}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="grid-cols-1">
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onResume} size="lg" type="button">
            <Play aria-hidden="true" /> {t('common.resume')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onRestart} size="lg" type="button">
            <RotateCcw aria-hidden="true" /> {t('common.restart')}
          </Button>
          <div className="mt-3 grid gap-2">
            <DialogDescription className="text-center text-[15px]">{t('classic.savePrompt')}</DialogDescription>
            <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onSaveAndQuit} size="lg" type="button">
              <Save aria-hidden="true" /> {t('common.saveAndQuit')}
            </Button>
            <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={onQuitWithoutSaving} size="lg" type="button">
              <LogOut aria-hidden="true" /> {t('common.quitWithoutSaving')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
