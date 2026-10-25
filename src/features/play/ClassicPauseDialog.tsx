import { LogOut, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ClassicPauseDialogProps {
  onOpenChange: (open: boolean) => void
  onQuit: () => void
  onRestart: () => void
  onResume: () => void
  open: boolean
}

export function ClassicPauseDialog(props: ClassicPauseDialogProps) {
  const { onOpenChange, onQuit, onRestart, onResume, open } = props
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('classic.paused')}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="grid-cols-1">
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onResume} size="lg" type="button">
            <Play aria-hidden="true" /> {t('common.resume')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onRestart} size="lg" type="button">
            <RotateCcw aria-hidden="true" /> {t('common.restart')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onQuit} size="lg" type="button">
            <LogOut aria-hidden="true" /> {t('common.quit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
