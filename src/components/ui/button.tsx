import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Slot } from 'radix-ui'
import { DepthButton, PAPER_DEPTH_SHADOW_COLOR, type DepthButtonProps } from './depth-surface'

const buttonVariants = cva('', {
  variants: {
    variant: {
      default: '',
      destructive: 'text-white',
      outline: '',
      secondary: '',
      ghost: '',
      link: 'text-primary underline-offset-4 hover:underline',
    },
    size: {
      default: 'h-9 px-4 py-2 has-[>svg]:px-3',
      xs: "h-6 gap-1 rounded-md px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
      sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
      lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
      icon: 'size-9',
      'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
      'icon-sm': 'size-8',
      'icon-lg': 'size-10',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

type ButtonProps = DepthButtonProps
  & VariantProps<typeof buttonVariants>
  & { asChild?: boolean }

/** The app's default action button. Ghost and link variants intentionally stay flat. */
function Button({ asChild = false, children, className, color, shadowColor, size = 'default', variant = 'default', ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }))
  if (asChild || variant === 'ghost' || variant === 'link') {
    const Comp = asChild ? Slot.Root : 'button'
    return (
      <Comp
        {...props}
        className={cn('inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--ios-radius)] [corner-shape:superellipse(1.5)] text-[15px] font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4', classes)}
        data-size={size}
        data-slot="button"
        data-variant={variant}
      >
        {children}
      </Comp>
    )
  }

  return (
    <DepthButton
      {...props}
      className={classes}
      color={color}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      shadowColor={shadowColor ?? (color === undefined || color === 'var(--paper)' ? PAPER_DEPTH_SHADOW_COLOR : undefined)}
    >
      {children}
    </DepthButton>
  )
}

export { Button, buttonVariants }
