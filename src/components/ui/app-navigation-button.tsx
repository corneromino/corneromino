import { useEffect, useRef, type ComponentProps, type MouseEventHandler, type PointerEventHandler } from 'react'
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'
import { Button } from './button'

interface AppNavigationButtonProps extends Omit<ComponentProps<typeof Button>, 'asChild' | 'onClick'> {
  navigationOptions?: NavigateOptions
  onClick?: MouseEventHandler<HTMLButtonElement>
  onPointerUp?: PointerEventHandler<HTMLButtonElement>
  to: To
}

/** A native button that performs in-app route navigation. */
export function AppNavigationButton({ navigationOptions, onClick, onPointerUp, to, type = 'button', ...buttonProps }: AppNavigationButtonProps) {
  const navigate = useNavigate()
  const suppressClickRef = useRef(false)
  const suppressClickTimeoutRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (suppressClickTimeoutRef.current !== null) window.clearTimeout(suppressClickTimeoutRef.current)
  }, [])

  function handleClick(event: Parameters<NonNullable<MouseEventHandler<HTMLButtonElement>>>[0]) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      event.preventDefault()
      return
    }
    onClick?.(event)
    if (!event.defaultPrevented) navigate(to, navigationOptions)
  }

  function handlePointerUp(event: Parameters<NonNullable<PointerEventHandler<HTMLButtonElement>>>[0]) {
    onPointerUp?.(event)
    if (event.pointerType !== 'touch' || event.defaultPrevented) return
    suppressClickRef.current = true
    if (suppressClickTimeoutRef.current !== null) window.clearTimeout(suppressClickTimeoutRef.current)
    suppressClickTimeoutRef.current = window.setTimeout(() => {
      suppressClickRef.current = false
      suppressClickTimeoutRef.current = null
    }, 0)
    onClick?.(event as unknown as Parameters<NonNullable<MouseEventHandler<HTMLButtonElement>>>[0])
    if (event.defaultPrevented) return
    event.preventDefault()
    navigate(to, navigationOptions)
  }

  return <Button {...buttonProps} onClick={handleClick} onPointerUp={handlePointerUp} type={type} />
}
