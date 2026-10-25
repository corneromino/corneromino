import { Bug, Play, RotateCcw, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CascadePauseDialogProps {
  onCopyDebugState: () => void
  onOpenChange: (open: boolean) => void
  onRestart: () => void
  onResume: () => void
  onSaveAndQuit: () => void
  open: boolean
}

export function CascadePauseDialog(props: CascadePauseDialogProps) {
  const { onCopyDebugState, onOpenChange, onRestart, onResume, onSaveAndQuit, open } = props
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cascade.paused')}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-1 gap-3">
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onResume} size="lg" type="button">
            <Play aria-hidden="true" /> {t('common.resume')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onRestart} size="lg" type="button">
            <RotateCcw aria-hidden="true" /> {t('common.restart')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onSaveAndQuit} size="lg" type="button">
            <Save aria-hidden="true" /> {t('common.saveAndQuit')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onCopyDebugState} size="lg" type="button">
            <Bug aria-hidden="true" /> {t('cascade.reportBug')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
