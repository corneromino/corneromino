import type { FocusEvent } from 'react'
import { Bug, Play, RotateCcw, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface VsPauseDialogProps {
  canReportBug: boolean
  debugCopy: { status: 'copying' | 'copied' | 'error'; text: string } | null
  onCopyDebugState: () => void
  onOpenChange: (open: boolean) => void
  onRestart: () => void
  onResume: () => void
  onSaveAndQuit: () => void
  onSelectDebugReport: (event: FocusEvent<HTMLTextAreaElement>) => void
  open: boolean
}

export function VsPauseDialog(props: VsPauseDialogProps) {
  const { canReportBug, debugCopy, onCopyDebugState, onOpenChange, onRestart, onResume, onSaveAndQuit, onSelectDebugReport, open } = props
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('versusGame.paused')}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-1 gap-3">
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onResume} size="lg" type="button">
            <Play aria-hidden="true" /> {t('versusGame.resume')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onRestart} size="lg" type="button">
            <RotateCcw aria-hidden="true" /> {t('versusGame.restart')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onSaveAndQuit} size="lg" type="button">
            <Save aria-hidden="true" /> {t('common.saveAndQuit')}
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={!canReportBug || debugCopy?.status === 'copying'} onClick={onCopyDebugState} size="lg" type="button">
            <Bug aria-hidden="true" /> {t('versusGame.reportBug')}
          </Button>
        </DialogFooter>
        {debugCopy?.status === 'copied' && <p className="mt-3 text-center text-[11px] text-[var(--muted-text-color)]" role="status">{t('versusGame.copied')}</p>}
        {debugCopy?.status === 'error' && <div className="mt-3">
          <p className="text-center text-[11px] text-[var(--coral)]" role="alert">{t('versusGame.copyFailed')}</p>
          <textarea aria-label={t('versusGame.debugReport')} className="mt-2 w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] p-2 text-[11px]" onFocus={onSelectDebugReport} readOnly rows={5} value={debugCopy.text} />
        </div>}
      </DialogContent>
    </Dialog>
  )
}
