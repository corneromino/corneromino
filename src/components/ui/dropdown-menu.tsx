import * as React from 'react'
import { Check } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger {...props} className={cn('dropdown-menu-trigger', props.className)} />
}

function DropdownMenuContent(props: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        collisionPadding={12}
        sideOffset={8}
        {...props}
        className={cn('dropdown-menu-content', props.className)}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem(props: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      {...props}
      className={cn('dropdown-menu-item', props.className)}
    />
  )
}

function DropdownMenuRadioItem({ children, className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem {...props} className={cn('dropdown-menu-item', className)}>
      <span className="min-w-0 flex-1">{children}</span>
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-4" strokeWidth={3} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.RadioItem>
  )
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger }
