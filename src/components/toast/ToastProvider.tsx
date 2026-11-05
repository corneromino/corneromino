import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DepthButton } from '@/components/ui/depth-surface'
import { cn } from '@/lib/utils'
import { TOAST_DURATION_MS, TOAST_MAX_VISIBLE, TOAST_POSITION, ToastContext, type ToastOptions, type ToastSize, type ToastVariant } from './toastContext'

export { TOAST_DURATION_MS, TOAST_MAX_VISIBLE, TOAST_POSITION, useToast } from './toastContext'

const MotionDepthButton = motion.create(DepthButton)

interface Toast extends Omit<ToastOptions, 'durationMs' | 'size' | 'variant'> {
  durationMs: number
  id: number
  size: ToastSize
  variant: ToastVariant
}

export function ToastProvider({ children, maxVisible = TOAST_MAX_VISIBLE, position = TOAST_POSITION }: { children: ReactNode; maxVisible?: number; position?: 'top' | 'bottom' | 'center' }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  const clear = useCallback(() => setToasts([]), [])
  const show = useCallback((options: ToastOptions) => {
    const id = ++nextId.current
    setToasts((current) => [...current, {
      ...options,
      durationMs: Math.max(0, options.durationMs ?? TOAST_DURATION_MS),
      id,
      size: options.size ?? 'medium',
      variant: options.variant ?? 'default',
    }])
    return id
  }, [])
  const value = useMemo(() => ({ clear, dismiss, show }), [clear, dismiss, show])
  const visibleCount = Math.max(1, Math.floor(maxVisible))

  return <ToastContext.Provider value={value}>
    {children}
    <ToastViewport dismiss={dismiss} position={position} toasts={toasts.slice(0, visibleCount)} />
  </ToastContext.Provider>
}

function ToastViewport({ dismiss, position, toasts }: { dismiss: (id: number) => void; position: 'top' | 'bottom' | 'center'; toasts: Toast[] }) {
  return (
    <div
      aria-atomic="false"
      aria-live="polite" 
      className={cn(
        'pointer-events-none fixed right-4 left-4 z-[100] mx-auto flex w-auto max-w-[420px] flex-col gap-2',
        position === 'top' && 'top-[calc(env(safe-area-inset-top,0px)+1rem)]',
        position === 'bottom' && 'bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)]',
        position === 'center' && 'top-1/2 -translate-y-1/2',
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => <ToastItem dismiss={dismiss} key={toast.id} toast={toast} />)}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ dismiss, toast }: { dismiss: (id: number) => void; toast: Toast }) {
  const reduceMotion = useReducedMotion()
  const timer = useRef<number | null>(null)
  const scheduleDismiss = useCallback(() => {
    if (toast.durationMs === 0) return
    timer.current = window.setTimeout(() => dismiss(toast.id), toast.durationMs)
  }, [dismiss, toast.durationMs, toast.id])
  // Timers belong to visible items only: queued toasts mount when a slot opens.
  useEffect(() => {
    scheduleDismiss()
    return () => { if (timer.current !== null) window.clearTimeout(timer.current) }
  }, [scheduleDismiss])

  return (
    <MotionDepthButton
      aria-label={toast.text ?? (typeof toast.message === 'string' ? toast.message : 'Dismiss notification')}
      borderColor={toast.variant === 'success' ? 'var(--mint)' : toast.variant === 'error' ? 'var(--coral)' : 'var(--outline-color)'}
      className={cn(
        'pointer-events-auto w-full text-center font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        // size
        toast.size === 'small' && 'px-3 py-2 text-[12px]',
        toast.size === 'large' && 'px-5 py-4 text-[30px]',
        toast.size === 'medium' && 'px-4 py-3 text-[14px]',
        // variant
        toast.variant === 'success' && 'text-[var(--mint)]',
        toast.variant === 'error' && 'text-[var(--coral)]',
        toast.variant === 'default' && 'text-[var(--canvas-foreground)]',

        toast.uppercase && "uppercase",
        toast.className
      )}
      color={toast.variant === 'success' ? '#c9e6b6' : toast.variant === 'error' ? '#ffd0bd' : 'var(--paper)'}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      layout
      onClick={() => dismiss(toast.id)}
      style={toast.style}
      transition={reduceMotion ? { duration: 0.15 } : { damping: 30, stiffness: 420, type: 'spring' }}
      type="button"
    >
      {toast.message}
    </MotionDepthButton>
  );
}
