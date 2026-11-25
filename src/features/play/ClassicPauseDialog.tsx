import { Copy, LogOut, Play, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ClassicGameDefinition } from '@/lib/db'

interface ClassicPauseDialogProps {
  gameMode: string
  gameDataForCopy?: ClassicGameDefinition
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
  const { gameDataForCopy, gameMode, isCareerLevel = false, isSaving, onOpenChange, onQuitWithoutSaving, onRestart, onResume, onSaveAndQuit, open, seed } = props
  const { t } = useTranslation()
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | null>(null)

  async function copyGameData() {
    try {
      if (!navigator.clipboard || !gameDataForCopy) throw new Error('Clipboard unavailable.')
      await navigator.clipboard.writeText(JSON.stringify(gameDataForCopy, null, 2))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <Dialog onOpenChange={(nextOpen) => { if (!nextOpen) setCopyStatus(null); onOpenChange(nextOpen) }} open={open}>
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
          {isCareerLevel && gameDataForCopy && <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={() => void copyGameData()} size="lg" type="button">
            <Copy aria-hidden="true" /> {t('classic.copyGameData')}
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
        {copyStatus === 'copied' && <p className="mt-3 text-center text-[11px] text-[var(--muted-text-color)]" role="status">{t('classic.gameDataCopied')}</p>}
        {copyStatus === 'error' && <p className="mt-3 text-center text-[11px] text-[var(--coral)]" role="alert">{t('classic.copyGameDataFailed')}</p>}
      </DialogContent>
    </Dialog>
  )
}
