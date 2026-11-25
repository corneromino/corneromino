// @vitest-environment jsdom
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/toast/ToastProvider'
import { isClassicGameDefinition, type ClassicGameDefinition } from '@/lib/db'

const mocks = vi.hoisted(() => ({ canvasProps: undefined as { pieces: readonly unknown[] } | undefined, saveDefinition: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/lib/gameDatabase', () => ({ openGameDatabase: () => Promise.resolve({}) }))
vi.mock('@/lib/db', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/db')>(),
  clearGameSelection: vi.fn(),
  loadGameSelection: vi.fn().mockResolvedValue({ completionResult: null, selectedCellKeys: [], lockedCellGroups: [], markers: [], moveCount: 0, unlockCount: 0, elapsedSeconds: 0, gameGridScreenshot: null, savedAt: null, isCompleted: false }),
  saveClassicGameDefinition: mocks.saveDefinition,
  saveGameSelection: vi.fn(),
}))
vi.mock('./GameGridCanvas', () => ({
  GameGridCanvas: forwardRef((props: { pieces: readonly unknown[]; onReady?: () => void }, ref) => {
    const { pieces, onReady } = props
    useEffect(() => { mocks.canvasProps = { pieces } }, [pieces])
    useImperativeHandle(ref, () => ({
      captureBoard: () => ({ toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['board'])) }),
      resetView: vi.fn(),
    }))
    useEffect(() => onReady?.(), [onReady])
    return <div data-testid="game-canvas" />
  }),
}))

import { GameGrid } from './GameGrid'
import { ClassicCreatePage } from './ClassicCreatePage'
import { ClassicPauseDialog } from './ClassicPauseDialog'
import { careerLevels } from './careerLevels'
import { createCareerGameDataForCopy } from './careerGameData'

const definition: ClassicGameDefinition = {
  config: { columns: 6, rows: 7, spread: 0.3, tetrominoCount: 1, lockingMode: 'auto' },
  bonus: [{ shape: 'O', count: 1 }],
  gameMode: 'c003', seed: 'career:level-20', version: 1,
  pieces: [{ id: 1, kind: 'O', cells: [
    { cellId: 'a', corner: 'top-left', x: 2, y: 1 },
    { cellId: 'b', corner: 'top-right', x: 3, y: 1 },
    { cellId: 'c', corner: 'bottom-left', x: 2, y: 2 },
    { cellId: 'd', corner: 'bottom-right', x: 3, y: 2 },
  ] }],
}

beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
  mocks.saveDefinition.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

it('copies the current Career puzzle from the pause menu and imports it into Create', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }))
  const view = render(<MemoryRouter><ToastProvider><GameGrid
    config={definition.config} gameDefinition={definition} gameDataForCopy={definition}
    gameId={definition.seed} gameMode={definition.gameMode} pieces={definition.pieces}
    isCareerLevel paused persistSelection={false}
    onElapsedSecondsChange={vi.fn()} onMoveCountChange={vi.fn()} onNextGame={vi.fn()} onPauseOpenChange={vi.fn()}
  /></ToastProvider></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'classic.copyGameData' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('classic.gameDataCopied'))
  const copied = writeText.mock.calls[0][0] as string
  expect(JSON.parse(copied)).toEqual(definition)
  view.unmount()

  render(<MemoryRouter><ClassicCreatePage /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'common.pause classic.title' }))
  fireEvent.click(screen.getByRole('button', { name: 'classic.pasteGameData' }))
  fireEvent.change(screen.getByLabelText('classic.gameData'), { target: { value: copied } })
  fireEvent.click(screen.getByRole('button', { name: 'classic.importGameData' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(mocks.canvasProps?.pieces).toEqual(definition.pieces.map((piece) => expect.objectContaining(piece)))

  fireEvent.click(screen.getByRole('button', { name: 'common.pause classic.title' }))
  fireEvent.change(screen.getByLabelText('classic.boardName'), { target: { value: 'Favorite Career board' } })
  fireEvent.click(screen.getByRole('button', { name: 'common.saveAndQuit' }))
  await waitFor(() => expect(mocks.saveDefinition).toHaveBeenCalledWith(expect.objectContaining({
    bonus: definition.bonus, config: expect.objectContaining(definition.config), pieces: definition.pieces,
    seed: expect.stringMatching(/^custom-/),
  })))
})

it('reports clipboard failures in the Career pause menu', async () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } }))
  render(<ClassicPauseDialog gameDataForCopy={definition} gameMode="c003" isCareerLevel isSaving={false} open seed={definition.seed}
    onOpenChange={vi.fn()} onQuitWithoutSaving={vi.fn()} onRestart={vi.fn()} onResume={vi.fn()} onSaveAndQuit={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'classic.copyGameData' }))
  expect((await screen.findByRole('alert')).textContent).toBe('classic.copyGameDataFailed')
})

it('accepts authored Career definitions, including tutorial alternatives, in Create mode', () => {
  for (const [index, level] of careerLevels.entries()) {
    if (!level.data || typeof level.data === 'function') continue
    for (const definition of Array.isArray(level.data) ? level.data : [level.data]) {
      if ('pieces' in definition) expect(isClassicGameDefinition(createCareerGameDataForCopy(definition, level.bonus)), `Career level ${index + 1}`).toBe(true)
    }
  }
})
