import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CorrectGameDialogProps {
  onNext: () => void
  onOpenChange: (open: boolean) => void
  screenshot: string | null
}

export function CorrectGameDialog(props: CorrectGameDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.screenshot !== null}>
      <DialogContent aria-describedby={undefined} className="max-w-[430px]">
        <DialogHeader>
          <DialogTitle>{t('classic.correct')}</DialogTitle>
        </DialogHeader>
        {props.screenshot && (
          <img
            alt={t('classic.completedBoard')}
            className="mx-auto mt-4 block max-h-[max(0px,calc(var(--dialog-viewport-height,var(--app-height))-220px))] max-w-full object-contain"
            src={props.screenshot}
          />
        )}
        <DialogFooter>
          <Button
            className="cartoon-press cartoon-press--green h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase"
            onClick={props.onNext}
            size="lg"
            type="button"
          >
            {t('common.next')}
          </Button>
          <DialogClose asChild>
            <Button
              className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase"
              size="lg"
              type="button"
            >
              {t('common.cancel')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
