import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ClassicMistakesDialogProps {
  mistakeCount: number
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function ClassicMistakesDialog(props: ClassicMistakesDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='text-(--coral)'>{t('classic.mistakes', { count: props.mistakeCount })}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="grid-cols-1">
          <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => props.onOpenChange(false)} size="lg" type="button">
            {t('common.ok')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
