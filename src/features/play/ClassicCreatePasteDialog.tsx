import { useTranslation } from 'react-i18next'
import { DepthButton, PAPER_DEPTH_SHADOW_COLOR } from '@/components/ui/depth-surface'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const TEXT_AREA_CLASS = 'mt-2 min-h-40 w-full resize-y border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 py-[11px] font-mono text-[13px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]'

interface ClassicCreatePasteDialogProps {
  error: string
  gameData: string
  onGameDataChange: (gameData: string) => void
  onImport: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

/** Imports a complete serialized Classic board into the Create editor. */
export function ClassicCreatePasteDialog(props: ClassicCreatePasteDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('classic.pasteGameData')}</DialogTitle>
          <DialogDescription>{t('classic.pasteGameDataDescription')}</DialogDescription>
        </DialogHeader>
        <label className="poster-kicker mt-5 block text-[11px] text-[var(--muted-text-color)]">
          {t('classic.gameData')}
          <textarea
            aria-invalid={props.error ? true : undefined}
            autoFocus
            className={TEXT_AREA_CLASS}
            onChange={(event) => props.onGameDataChange(event.target.value)}
            spellCheck={false}
            value={props.gameData}
          />
        </label>
        {props.error && <p className="mt-3 text-[11px] text-[var(--coral)]" role="alert">{props.error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <DepthButton className="h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" shadowColor={PAPER_DEPTH_SHADOW_COLOR}>
              {t('common.cancel')}
            </DepthButton>
          </DialogClose>
          <DepthButton className="h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={props.onImport} shadowColor={PAPER_DEPTH_SHADOW_COLOR}>
            {t('classic.importGameData')}
          </DepthButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
