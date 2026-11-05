import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties, type ElementType } from 'react'
import { cn } from 'cn'

type CssLength = number | string

interface DepthAppearanceProps {
  /** Surface background color. */
  color?: string
  /** Height of the darker lower band. */
  depth?: CssLength
  /** Color mixed into the lower band. */
  shadeColor?: string
  /** Percentage of shadeColor in the lower band. */
  shadeStrength?: number
  /** Exact lower-band color. Takes precedence over the derived shade. */
  shadowColor?: string
  /** Face color while a DepthButton is pressed. */
  activeColor?: string
  /** Face color while a DepthButton is hovered. */
  hoverColor?: string
  borderColor?: string
  borderWidth?: CssLength
  radius?: CssLength
  outlineColor?: string
  outlineWidth?: CssLength
}

type DepthVariables = CSSProperties & Record<`--depth-${string}`, string>

export const DEPTH_BUTTON_COLORS = {
  blue: { color: '#73a9ee', activeColor: '#4d85c9', hoverColor: '#91c2ff', shadowColor: '#315c91' },
  green: { color: '#8acb7a', activeColor: '#5caa65', hoverColor: '#a8dea0', shadowColor: '#315c45' },
  red: { color: '#e4555c', activeColor: '#ba3f48', hoverColor: '#f0787e', shadowColor: '#84343b' },
} as const

function depthStyle({
  color = 'var(--paper)',
  depth = '6px',
  shadeColor = 'var(--outline-color)',
  shadeStrength = 35,
  borderColor = 'var(--outline-color)',
  borderWidth = 'var(--outline-width)',
  radius = 'var(--ios-radius)',
  outlineColor = 'rgb(21 16 14 / 8%)',
  outlineWidth = '1px',
  shadowColor,
  activeColor = color,
  hoverColor = color,
  style,
}: DepthAppearanceProps & { style?: CSSProperties }): DepthVariables {
  return {
    '--depth-color': color,
    '--depth-size': typeof depth === 'number' ? `${depth}px` : depth,
    '--depth-shadow-color': shadowColor ?? `color-mix(in srgb, ${color} ${100 - shadeStrength}%, ${shadeColor})`,
    '--depth-active-color': activeColor,
    '--depth-hover-color': hoverColor,
    '--depth-border-color': borderColor,
    '--depth-border-width': typeof borderWidth === 'number' ? `${borderWidth}px` : borderWidth,
    '--depth-radius': typeof radius === 'number' ? `${radius}px` : radius,
    '--depth-outline-color': outlineColor,
    '--depth-outline-width': typeof outlineWidth === 'number' ? `${outlineWidth}px` : outlineWidth,
    borderColor: 'var(--depth-border-color)',
    borderRadius: 'var(--depth-radius)',
    borderStyle: 'solid',
    borderWidth: 'var(--depth-border-width)',
    ...style,
  }
}

const depthSurfaceClass = 'relative inline-flex items-center justify-center overflow-hidden pb-[var(--depth-size)] bg-[var(--depth-color)] rounded-[var(--depth-radius)] [corner-shape:superellipse(1.5)] shadow-[inset_0_calc(var(--depth-size)_*_-1)_0_var(--depth-shadow-color),0_0_0_var(--depth-outline-width)_var(--depth-outline-color)] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[var(--depth-size)] after:bg-[var(--depth-shadow-color)] after:origin-bottom'

export interface DepthSurfaceProps extends ComponentPropsWithoutRef<'div'>, DepthAppearanceProps {
  as?: ElementType
}

/** A non-interactive surface with the app's outlined, inset-depth treatment. */
export const DepthSurface = forwardRef<HTMLElement, DepthSurfaceProps>(function DepthSurface(
  { as: Component = 'div', activeColor, borderColor, borderWidth, className, color, depth, hoverColor, outlineColor, outlineWidth, radius, shadeColor, shadeStrength, shadowColor, style, ...props },
  ref,
) {
  return (
    <Component
      {...props}
      className={cn(depthSurfaceClass, className)}
      ref={ref}
      style={depthStyle({ activeColor, borderColor, borderWidth, color, depth, hoverColor, outlineColor, outlineWidth, radius, shadeColor, shadeStrength, shadowColor, style })}
    />
  )
})

export interface DepthButtonProps extends ComponentPropsWithoutRef<'button'>, DepthAppearanceProps {}

/** A native button with the app's outlined, inset-depth treatment and press motion. */
export const DepthButton = forwardRef<HTMLButtonElement, DepthButtonProps>(function DepthButton(
  { activeColor = '#e49a50', borderColor = '#713324', borderWidth, children, className, color = 'var(--paper)', depth, hoverColor = '#ffe0a4', outlineColor, outlineWidth, radius, shadeColor, shadeStrength, shadowColor = '#b95c2e', style, type = 'button', ...props },
  ref,
) {
  return (
    <button
      {...props}
      className={cn(depthSurfaceClass, 'shrink-0 gap-2 text-[15px] font-medium whitespace-nowrap outline-none cursor-pointer touch-manipulation select-none [-webkit-tap-highlight-color:transparent] transition-[box-shadow,background-color] duration-[80ms] focus-visible:outline-2 focus-visible:outline-[var(--outline-color)] focus-visible:outline-offset-2 after:transition-transform after:duration-[80ms] hover:bg-[var(--depth-hover-color)] active:bg-[var(--depth-active-color)] active:shadow-[inset_0_-1px_0_var(--depth-shadow-color),0_0_0_var(--depth-outline-width)_var(--depth-outline-color)] active:[&>.depth-button-content]:translate-y-[calc(var(--depth-size)_/_2)] active:after:scale-y-[0.166667] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4', className)}
      ref={ref}
      style={depthStyle({ activeColor, borderColor, borderWidth, color, depth, hoverColor, outlineColor, outlineWidth, radius, shadeColor, shadeStrength, shadowColor, style })}
      type={type}
    >
      <span className="depth-button-content inline-flex min-w-0 items-center justify-center gap-[inherit] transition-transform duration-[80ms]">{children}</span>
    </button>
  )
})
