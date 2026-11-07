// @vitest-environment jsdom
import { forwardRef, useImperativeHandle } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GAME_CONFIGS } from '@/game/gameConfig'

const canvasProps = vi.hoisted(() => ({ current: undefined as {
  config: { columns: number; rows: number; tetrominoCount: number }
  interactive?: boolean
  onToggle: (cellKey: string, timeStamp: number) => void
  pieces: readonly { cells: readonly { corner: string; x: number; y: number }[] }[]
  temporaryCellKeys?: readonly string[]
} | undefined }))
const persistence = vi.hoisted(() => ({ captureBoard: vi.fn(), loadClassicGameDefinition: vi.fn(), saveClassicGameDefinition: vi.fn(), saveGameSelection: vi.fn() }))
type CanvasProps = NonNullable<typeof canvasProps.current>

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/lib/db', () => ({
  loadClassicGameDefinition: persistence.loadClassicGameDefinition,
  saveClassicGameDefinition: persistence.saveClassicGameDefinition,
  saveGameSelection: persistence.saveGameSelection,
}))
vi.mock('./GameGridCanvas', () => ({
  GameGridCanvas: forwardRef((props: CanvasProps, ref) => {
    canvasProps.current = props
    useImperativeHandle(ref, () => ({
      captureBoard: (options?: { gameplayPreview?: boolean }) => {
        persistence.captureBoard(options)
        return { toBlob: (callback: (blob: Blob) => void) => queueMicrotask(() => callback(new Blob(['board'], { type: 'image/png' }))) }
      },
      resetView: vi.fn(),
    }))
    return <div data-testid="create-grid" />
  }),
}))

import { CLASSIC_CREATE_DRAFT_STORAGE_KEY, ClassicCreatePage } from './ClassicCreatePage'

beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

it('renders an empty navigable 5 by 5 Classic board', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  expect(screen.getByTestId('create-grid')).toBeTruthy()
  expect(canvasProps.current).toMatchObject({
    config: { columns: 5, navigationEnabled: true, rows: 5, tetrominoCount: 0 },
    interactive: true,
    pieces: [],
    showAuthoredPieceColors: true,
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

it('removes an entire Cantomino if reducing the board would put any of its cells outside', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.placeCells' }))
  for (const key of ['0,0', '1,0', '0,1', '1,1', '3,3', '4,3', '3,4', '4,4']) act(() => canvasProps.current!.onToggle(key, 0))
  expect(canvasProps.current?.pieces).toHaveLength(2)

  fireEvent.click(screen.getByRole('button', { name: 'classic.configureBoardSize' }))
  fireEvent.change(screen.getByLabelText('classic.columns'), { target: { value: '4' } })
  fireEvent.change(screen.getByLabelText('classic.rows'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'classic.applyBoardSize' }))

  expect(canvasProps.current?.pieces).toHaveLength(1)
  expect(canvasProps.current?.pieces[0]?.cells).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 0, y: 0 }),
    expect.objectContaining({ x: 1, y: 1 }),
  ]))
})

it('places valid temporary cells as a Cantomino and rotates its corners in placement mode', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.placeCells' }))
  act(() => canvasProps.current!.onToggle('0,0', 0))
  act(() => canvasProps.current!.onToggle('1,0', 0))
  act(() => canvasProps.current!.onToggle('0,1', 0))
  expect(canvasProps.current?.temporaryCellKeys).toEqual(['0,0', '1,0', '0,1'])
  act(() => canvasProps.current!.onToggle('1,0', 0))
  expect(canvasProps.current?.temporaryCellKeys).toEqual(['0,0', '0,1'])
  act(() => canvasProps.current!.onToggle('1,0', 0))
  act(() => canvasProps.current!.onToggle('1,1', 0))
  expect(canvasProps.current?.temporaryCellKeys).toEqual([])
  expect(canvasProps.current?.pieces).toHaveLength(1)
  expect(new Set(canvasProps.current?.pieces[0]?.cells.map((cell) => cell.corner))).toEqual(new Set(['top-left', 'top-right', 'bottom-right', 'bottom-left']))

  act(() => canvasProps.current!.onToggle('0,0', 0))
  expect(canvasProps.current?.pieces[0]?.cells.find((cell) => cell.x === 0 && cell.y === 0)?.corner).not.toBeUndefined()
})

it('shows the live repetition count beside the placement control', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.placeCells' }))
  for (const key of ['0,0', '1,0', '0,1', '1,1']) act(() => canvasProps.current!.onToggle(key, 0))
  const repetitionCount = screen.getByLabelText('classic.mistakes')
  expect(repetitionCount.textContent).toBe('0')

  act(() => canvasProps.current!.onToggle('0,0', 0))
  expect(repetitionCount.textContent).toBe('1')
})

it('discards an unfinished placement when placement mode is turned off', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  const placementButton = screen.getByRole('button', { name: 'classic.placeCells' })
  fireEvent.click(placementButton)
  act(() => canvasProps.current!.onToggle('0,0', 0))
  expect(canvasProps.current?.temporaryCellKeys).toEqual(['0,0'])
  fireEvent.click(placementButton)
  expect(canvasProps.current?.temporaryCellKeys).toEqual([])
})

it('resets confirmed and unfinished placements without changing the board size', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.placeCells' }))
  act(() => canvasProps.current!.onToggle('0,0', 0))
  expect(canvasProps.current?.temporaryCellKeys).toEqual(['0,0'])
  fireEvent.click(screen.getByRole('button', { name: 'classic.resetBoard' }))

  expect(canvasProps.current?.temporaryCellKeys).toEqual([])
  expect(canvasProps.current?.pieces).toEqual([])
  expect(canvasProps.current?.config).toMatchObject({ columns: 5, rows: 5 })
})

it('erases an entire Cantomino in erase mode and exits the mode when toggled again', () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.placeCells' }))
  for (const key of ['0,0', '1,0', '0,1', '1,1']) act(() => canvasProps.current!.onToggle(key, 0))
  expect(canvasProps.current?.pieces).toHaveLength(1)

  const eraseButton = screen.getByRole('button', { name: 'classic.erasePiece' })
  fireEvent.click(eraseButton)
  expect(eraseButton.getAttribute('aria-pressed')).toBe('true')
  act(() => canvasProps.current!.onToggle('1,1', 0))
  expect(canvasProps.current?.pieces).toEqual([])
  fireEvent.click(eraseButton)
  expect(eraseButton.getAttribute('aria-pressed')).toBe('false')
})

it('restores confirmed authored pieces from the current browser session', () => {
  sessionStorage.setItem(CLASSIC_CREATE_DRAFT_STORAGE_KEY, JSON.stringify({
    dimensions: { columns: 6, rows: 6 },
    pieces: [{
      color: '#55c7df',
      id: 1,
      kind: 'O',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 2, y: 2 },
        { cellId: 'b', corner: 'bottom-right', x: 3, y: 2 },
        { cellId: 'c', corner: 'bottom-left', x: 2, y: 3 },
        { cellId: 'd', corner: 'top-left', x: 3, y: 3 },
      ],
    }],
  }))

  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  expect(canvasProps.current?.config).toMatchObject({ columns: 6, rows: 6 })
  expect(canvasProps.current?.pieces).toHaveLength(1)
})

it('loads every saved board into Create, but starts a non-custom edit with no name', async () => {
  persistence.loadClassicGameDefinition.mockResolvedValue({
    config: GAME_CONFIGS.c004,
    gameMode: 'c004',
    pieces: [{
      id: 1,
      kind: 'O',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 2, y: 2 },
        { cellId: 'b', corner: 'bottom-right', x: 3, y: 2 },
        { cellId: 'c', corner: 'bottom-left', x: 2, y: 3 },
        { cellId: 'd', corner: 'top-left', x: 3, y: 3 },
      ],
    }],
    seed: 'regular-save',
    version: 1,
  })
  render(<MemoryRouter initialEntries={[{ pathname: '/play/create', state: { editGame: { gameId: 'regular-save', gameMode: 'c004', isCustom: false, name: null } } }]}><ClassicCreatePage /></MemoryRouter>)

  await waitFor(() => expect(canvasProps.current?.config).toMatchObject({ columns: 10, rows: 15 }))
  expect(canvasProps.current?.pieces).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'common.pause classic.title' }))
  expect((screen.getByLabelText('classic.boardName') as HTMLInputElement).value).toBe('')
})

it('saves a custom definition and normal-game selection from its pause menu', async () => {
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'common.pause classic.title' }))
  fireEvent.change(screen.getByLabelText('classic.boardName'), { target: { value: 'My board' } })
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
    customName: 'My board',
    pieces: [],
    source: 'custom',
  }))
  expect(persistence.saveGameSelection).toHaveBeenCalledWith('c003', expect.stringMatching(/^custom-/), expect.objectContaining({
    gameGridScreenshot: expect.any(Blob),
    savedAt: expect.any(Number),
  }))
  expect(persistence.captureBoard).toHaveBeenCalledWith({ gameplayPreview: true })
})

it('copies the exact custom game definition that Save uses, without editor-only piece colors', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.placeCells' }))
  for (const key of ['0,0', '1,0', '0,1', '1,1']) act(() => canvasProps.current!.onToggle(key, 0))
  fireEvent.click(screen.getByRole('button', { name: 'common.pause classic.title' }))
  fireEvent.change(screen.getByLabelText('classic.boardName'), { target: { value: 'Career export' } })
  fireEvent.click(screen.getByRole('button', { name: 'classic.copyGameData' }))

  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  const gameData = JSON.parse(writeText.mock.calls[0]![0] as string)
  expect(gameData).toMatchObject({
    config: { columns: 5, rows: 5, tetrominoCount: 1 },
    customName: 'Career export',
    gameMode: 'c003',
    seed: expect.stringMatching(/^custom-/),
    source: 'custom',
    version: 1,
  })
  expect(gameData.pieces).toHaveLength(1)
  expect(gameData.pieces[0]).not.toHaveProperty('color')
  expect(gameData.config).not.toHaveProperty('title')
  expect(screen.getByRole('status').textContent).toBe('classic.gameDataCopied')

  fireEvent.click(screen.getByRole('button', { name: 'common.saveAndQuit' }))
  await waitFor(() => expect(persistence.saveClassicGameDefinition).toHaveBeenCalledWith(gameData))
})
