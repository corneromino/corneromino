import { useTranslation } from 'react-i18next'
import { DepthButton, PAPER_DEPTH_SHADOW_COLOR } from '@/components/ui/depth-surface'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const INPUT_CLASS = 'mt-2 py-[11px] w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 text-[15px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]'

interface ClassicCreateSettingsDialogProps {
  dimensions: { columns: string; rows: string }
  error: string
  onApply: () => void
  onDimensionsChange: (dimensions: { columns: string; rows: string }) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

/** Board-dimension settings for Classic Create mode. */
export function ClassicCreateSettingsDialog(props: ClassicCreateSettingsDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{t('common.settings')}</DialogTitle></DialogHeader>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="poster-kicker block text-[11px] text-[var(--muted-text-color)]">
            {t('classic.rows')}
            <input
              autoFocus
              className={INPUT_CLASS}
              min="1"
              onChange={(event) => props.onDimensionsChange({ ...props.dimensions, rows: event.target.value })}
              step="1"
              type="number"
              value={props.dimensions.rows}
            />
          </label>
          <label className="poster-kicker block text-[11px] text-[var(--muted-text-color)]">
            {t('classic.columns')}
            <input
              className={INPUT_CLASS}
              min="1"
              onChange={(event) => props.onDimensionsChange({ ...props.dimensions, columns: event.target.value })}
              step="1"
              type="number"
              value={props.dimensions.columns}
            />
          </label>
        </div>
        {props.error && <p className="mt-3 text-[11px] text-[var(--coral)]" role="alert">{props.error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <DepthButton className="h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" shadowColor={PAPER_DEPTH_SHADOW_COLOR}>
              {t('common.cancel')}
            </DepthButton>
          </DialogClose>
          <DepthButton className="h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={props.onApply} shadowColor={PAPER_DEPTH_SHADOW_COLOR}>
            {t('classic.applyBoardSize')}
          </DepthButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
