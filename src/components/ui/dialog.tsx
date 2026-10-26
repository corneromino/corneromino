import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogClose = DialogPrimitive.Close

function DialogContent(props: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#15100e]/60" />
      <DialogPrimitive.Content
        {...props}
        className={cn(
          'dialog-content fixed top-1/2 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--outline-color)] bg-[var(--paper)] p-5 shadow-[0_12px_0_var(--canvas-deep)] outline-none',
          props.className,
        )}
      />
    </DialogPrimitive.Portal>
  )
}

function DialogHeader(props: React.ComponentProps<'div'>) {
  return <div {...props} className={cn('text-center', props.className)} />
}

function DialogFooter(props: React.ComponentProps<'div'>) {
  return <div {...props} className={cn('mt-5 grid grid-cols-2 gap-3', props.className)} />
}

function DialogTitle(props: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title {...props} className={cn('poster-title text-[33px]', props.className)} />
}

function DialogDescription(props: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description {...props} className={cn('mt-3 text-[11px] leading-relaxed text-[var(--muted-text-color)]', props.className)} />
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle }
