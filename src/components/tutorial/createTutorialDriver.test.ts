// @vitest-environment jsdom
import { cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('driver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('driver.js')>()
  return { ...actual, driver: (options: Parameters<typeof actual.driver>[0]) => actual.driver({ ...options, animate: false }) }
})

import { createTutorialDriver } from './createTutorialDriver'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('createTutorialDriver', () => {
  it('uses Next to close an unlocked final step', () => {
    const target = document.createElement('div')
    target.id = 'tutorial-target'
    document.body.append(target)
    const onClose = vi.fn()
    const tutorial = createTutorialDriver([{
      element: '#tutorial-target',
      popover: { description: 'Final step' },
    }], { onClose })

    tutorial.drive()

    const next = document.querySelector<HTMLButtonElement>('.driver-popover-next-btn')!
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
