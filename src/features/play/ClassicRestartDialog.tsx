import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ClassicRestartDialogProps {
  onOpenChange: (open: boolean) => void
  onRestart: () => void
  open: boolean
}

/** Prevents an accidental loss of Classic board progress. */
export function ClassicRestartDialog(props: ClassicRestartDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('common.restart')}</DialogTitle>
          <DialogDescription>{t('classic.restartConfirmation')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button className="text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">{t('common.cancel')}</Button></DialogClose>
          <Button className="text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={props.onRestart} size="lg" type="button">{t('common.restart')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
