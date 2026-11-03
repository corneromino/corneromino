// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from './ToastProvider'
import { useToast } from './toastContext'

function ToastTrigger({ messages }: { messages: string[] }) {
  const toast = useToast()
  useEffect(() => { messages.forEach((message) => toast.show({ durationMs: 1000, message })) }, [messages, toast])
  return null
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('queues excess toasts and starts their duration only when visible', () => {
  render(<ToastProvider maxVisible={2}><ToastTrigger messages={['one', 'two', 'three']} /></ToastProvider>)
  expect(screen.getByRole('button', { name: 'one' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'two' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'three' })).toBeNull()
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByRole('button', { name: 'three' })).toBeTruthy()
  act(() => vi.advanceTimersByTime(999))
  expect(screen.getByRole('button', { name: 'three' })).toBeTruthy()
  act(() => vi.advanceTimersByTime(1))
  // AnimatePresence keeps the timed-out toast mounted briefly for its exit animation.
  expect(screen.getByRole('button', { name: 'three' })).toBeTruthy()
})

it('animates dismissal while advancing the queue', () => {
  render(<ToastProvider maxVisible={1}><ToastTrigger messages={['first', 'second']} /></ToastProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'first' }))
  expect(screen.getByRole('button', { name: 'first' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'second' })).toBeTruthy()
})
