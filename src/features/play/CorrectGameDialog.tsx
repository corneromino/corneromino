import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CorrectGameDialogProps {
  onNext: () => void
  onOpenChange: (open: boolean) => void
  screenshot: string | null
}

export function CorrectGameDialog(props: CorrectGameDialogProps) {
  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.screenshot !== null}>
      <DialogContent aria-describedby={undefined} className="max-w-[430px]">
        <DialogHeader>
          <DialogTitle>Correct</DialogTitle>
        </DialogHeader>
        {props.screenshot && (
          <img
            alt="Completed game board"
            className="mx-auto mt-4 block max-h-[calc(100dvh-220px)] max-w-full object-contain"
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
            Next
          </Button>
          <DialogClose asChild>
            <Button
              className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase"
              size="lg"
              type="button"
            >
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
