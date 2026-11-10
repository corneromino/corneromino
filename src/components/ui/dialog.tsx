import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { DepthSurface } from './depth-surface'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogClose = DialogPrimitive.Close

interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  floatingContent?: React.ReactNode
}

function DialogContent({ children, className, floatingContent, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#15100e]/60" />
      <DepthSurface
        {...props}
        as={DialogPrimitive.Content}
        depth={8}
        shadowColor="#b95c2e"
          className={cn(
            'dialog-content fixed top-1/2 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[340px] -translate-x-1/2 -translate-y-1/2 outline-none',
            floatingContent && '!overflow-visible',
            className,
          )}
      >
        {floatingContent}
        <div className="dialog-content-surface">{children}</div>
      </DepthSurface>
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
  return <DialogPrimitive.Description {...props} className={cn('mt-3 text-[15px] leading-relaxed text-[var(--muted-text-color)]', props.className)} />
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle }
