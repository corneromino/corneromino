import type { FocusEvent } from 'react'
import { Bug, Play, RotateCcw, Save } from 'lucide-react'
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Paused</DialogTitle>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-1 gap-3">
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onResume} size="lg" type="button">
            <Play aria-hidden="true" /> Resume
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onRestart} size="lg" type="button">
            <RotateCcw aria-hidden="true" /> Restart
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={onSaveAndQuit} size="lg" type="button">
            <Save aria-hidden="true" /> Save and quit
          </Button>
          <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={!canReportBug || debugCopy?.status === 'copying'} onClick={onCopyDebugState} size="lg" type="button">
            <Bug aria-hidden="true" /> Report a bug
          </Button>
        </DialogFooter>
        {debugCopy?.status === 'copied' && <p className="mt-3 text-center text-[11px] text-[var(--muted-text-color)]" role="status">Game state copied. Paste it into your bug report.</p>}
        {debugCopy?.status === 'error' && <div className="mt-3">
          <p className="text-center text-[11px] text-[var(--coral)]" role="alert">Could not copy automatically. Copy the report below.</p>
          <textarea aria-label="Game debug report" className="mt-2 w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] p-2 text-[11px]" onFocus={onSelectDebugReport} readOnly rows={5} value={debugCopy.text} />
        </div>}
      </DialogContent>
    </Dialog>
  )
}
