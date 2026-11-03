import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'

export const TOAST_POSITION: 'top' | 'bottom' | 'center' = 'center'
export const TOAST_MAX_VISIBLE = 3
export const TOAST_DURATION_MS = 4000

export type ToastVariant = 'default' | 'success' | 'error'
export type ToastSize = 'small' | 'medium' | 'large'

export interface ToastOptions {
  className?: string
  durationMs?: number
  message: ReactNode
  size?: ToastSize
  style?: CSSProperties
  text?: string
  variant?: ToastVariant
  uppercase?: boolean
}

export interface ToastContextValue {
  clear: () => void
  dismiss: (id: number) => void
  show: (options: ToastOptions) => number
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider.')
  return context
}
