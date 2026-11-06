import { Copy, LogOut, Play, Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const INPUT_CLASS = 'mt-2 py-[11px] w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 text-[15px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]'

interface ClassicCreatePauseDialogProps {
  boardName: string
  gameDataJson: string
  isSaving: boolean
  onBoardNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onQuitWithoutSaving: () => void
  onSaveAndQuit: () => Promise<void>
  open: boolean
  saveError: string
}

/** Pause controls and save actions for Classic Create mode. */
export function ClassicCreatePauseDialog(props: ClassicCreatePauseDialogProps) {
  const { t } = useTranslation()
  const [copyError, setCopyError] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyGameData() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable.')
      await navigator.clipboard.writeText(props.gameDataJson)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopied(false)
      setCopyError(true)
    }
  }

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{t('classic.paused')}</DialogTitle></DialogHeader>
        <DialogFooter className="grid-cols-1">
          <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={props.isSaving} onClick={() => props.onOpenChange(false)} size="lg" type="button">
            <Play aria-hidden="true" /> {t('common.resume')}
          </Button>
          <div className="mt-3 grid gap-2">
            <DialogDescription className="text-center text-[18px]">{t('classic.savePrompt')}</DialogDescription>
            <label className="poster-kicker block text-[11px] text-[var(--muted-text-color)]">
              {t('classic.boardName')}
              <input
                className={INPUT_CLASS}
                onChange={(event) => props.onBoardNameChange(event.target.value)}
                value={props.boardName}
              />
            </label>
            <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={props.isSaving} onClick={() => void props.onSaveAndQuit()} size="lg" type="button">
              <Save aria-hidden="true" /> {t('common.saveAndQuit')}
            </Button>
            <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={props.isSaving} onClick={() => void copyGameData()} size="lg" type="button">
              <Copy aria-hidden="true" /> {t('classic.copyGameData')}
            </Button>
            <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={props.isSaving} onClick={props.onQuitWithoutSaving} size="lg" type="button">
              <LogOut aria-hidden="true" /> {t('common.quitWithoutSaving')}
            </Button>
          </div>
        </DialogFooter>
        {copied && <p className="mt-3 text-center text-[11px] text-[var(--muted-text-color)]" role="status">{t('classic.gameDataCopied')}</p>}
        {copyError && <p className="mt-3 text-center text-[11px] text-[var(--coral)]" role="alert">{t('classic.copyGameDataFailed')}</p>}
        {props.saveError && <p className="mt-3 text-center text-[11px] text-[var(--coral)]" role="alert">{props.saveError}</p>}
      </DialogContent>
    </Dialog>
  )
}
