import type { ComponentProps, MouseEventHandler } from 'react'
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'
import { Button } from './button'

interface AppNavigationButtonProps extends Omit<ComponentProps<typeof Button>, 'asChild' | 'onClick'> {
  navigationOptions?: NavigateOptions
  onClick?: MouseEventHandler<HTMLButtonElement>
  to: To
}

/** A native button that performs in-app route navigation. */
export function AppNavigationButton({ navigationOptions, onClick, to, type = 'button', ...buttonProps }: AppNavigationButtonProps) {
  const navigate = useNavigate()

  function handleClick(event: Parameters<NonNullable<MouseEventHandler<HTMLButtonElement>>>[0]) {
    onClick?.(event)
    if (!event.defaultPrevented) navigate(to, navigationOptions)
  }

  return <Button {...buttonProps} onClick={handleClick} type={type} />
}
