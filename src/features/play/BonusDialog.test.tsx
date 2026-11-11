// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BonusDialog } from './BonusDialog'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

afterEach(cleanup)

it('renders one corner-free tetromino preview for every bonus requirement', () => {
  render(
    <BonusDialog
      bonus={[
        { count: 2, rotation: 1, shape: 'L' },
        { count: 0, shape: 'I' },
      ]}
      onOpenChange={vi.fn()}
      open
    />,
  )

  expect(screen.getByRole('heading', { name: 'bonus.title' })).toBeTruthy()
  expect(screen.getByText('x2')).toBeTruthy()
  expect(screen.getByText('x0')).toBeTruthy()
  expect(screen.getByLabelText('bonus.anyRotation')).toBeTruthy()
  expect(screen.getAllByTestId('bonus-tetromino-cell')).toHaveLength(8)
  expect(document.querySelectorAll('svg rect')).toHaveLength(0)
})
