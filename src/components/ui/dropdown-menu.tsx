import * as React from 'react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

function DropdownMenuContent(props: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        {...props}
        className={cn(
          'z-50 min-w-[94px] rounded-md border border-[var(--outline-color)] bg-[var(--paper)] p-1 shadow-[0_4px_0_var(--canvas-deep)] outline-none',
          props.className,
        )}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem(props: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      {...props}
      className={cn(
          'flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-[11px] font-bold uppercase outline-none hover:bg-[var(--paper-muted)] focus:bg-[var(--paper-muted)]',
        props.className,
      )}
    />
  )
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger }
