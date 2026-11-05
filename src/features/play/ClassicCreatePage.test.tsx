// @vitest-environment jsdom
import { forwardRef, useImperativeHandle } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'

const canvasProps = vi.hoisted(() => ({ current: undefined as { config: { columns: number; rows: number; tetrominoCount: number }; interactive?: boolean; pieces: readonly unknown[] } | undefined }))
const persistence = vi.hoisted(() => ({ saveClassicGameDefinition: vi.fn(), saveGameSelection: vi.fn() }))
type CanvasProps = NonNullable<typeof canvasProps.current>

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/lib/db', () => ({
  saveClassicGameDefinition: persistence.saveClassicGameDefinition,
  saveGameSelection: persistence.saveGameSelection,
}))
vi.mock('./GameGridCanvas', () => ({
  GameGridCanvas: forwardRef((props: CanvasProps, ref) => {
    canvasProps.current = props
    useImperativeHandle(ref, () => ({ captureBoard: () => ({ toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['board'], { type: 'image/png' })) }), resetView: vi.fn() }))
    return <div data-testid="create-grid" />
  }),
}))

import { ClassicCreatePage } from './ClassicCreatePage'

afterEach(cleanup)

it('renders an empty navigable 5 by 5 Classic board', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  expect(screen.getByTestId('create-grid')).toBeTruthy()
  expect(canvasProps.current).toMatchObject({
    config: { columns: 5, navigationEnabled: true, rows: 5, tetrominoCount: 0 },
    interactive: true,
    pieces: [],
  })
})

it('applies configured row and column counts to the board', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.configureBoardSize' }))
  fireEvent.change(screen.getByLabelText('classic.columns'), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('classic.rows'), { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: 'classic.applyBoardSize' }))

  expect(canvasProps.current?.config).toMatchObject({ columns: 8, rows: 6, tetrominoCount: 0 })
})

it('saves a custom definition and normal-game selection from its pause menu', async () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'common.pause classic.title' }))
  fireEvent.click(screen.getByRole('button', { name: 'common.saveAndQuit' }))

  await waitFor(() => expect(persistence.saveClassicGameDefinition).toHaveBeenCalledOnce())
  expect(persistence.saveClassicGameDefinition).toHaveBeenCalledWith(expect.objectContaining({
    config: expect.objectContaining({
      columns: 5,
      completionScreenshotDelayMs: 400,
      finalLockAnimationEnabled: true,
      finalVerificationMode: 'auto',
      hideGameControls: false,
      lockingMode: 'auto',
      rows: 5,
      tetrominoCount: 0,
    }),
    gameMode: 'c003',
    pieces: [],
    source: 'custom',
  }))
  expect(persistence.saveGameSelection).toHaveBeenCalledWith('c003', expect.stringMatching(/^custom-/), expect.objectContaining({
    gameGridScreenshot: expect.any(Blob),
    savedAt: expect.any(Number),
  }))
})
