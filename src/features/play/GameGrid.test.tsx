// @vitest-environment jsdom
import { StrictMode, useEffect, useImperativeHandle, type ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CELL_CORNERS, GAME_CONFIGS, type GameSelectionState, type PlacedTetromino } from '@/game/gameConfig'
import { loadGameSelection, saveGameSelection, type ClassicGameDefinition } from '@/lib/db'
import { ToastProvider } from '@/components/toast/ToastProvider'
import { level2 } from '@/assets/levels/2'
import { getGridMetrics, screenToGridCell } from '@/rendering/grid/gridGeometry'
import type { GameGridCanvas } from './GameGridCanvas'
import { GameGrid } from './GameGrid'

const canvasMock = vi.hoisted(() => ({ autoReady: true, captureBoard: vi.fn(), clientToCell: vi.fn(), props: undefined as ComponentProps<typeof GameGridCanvas> | undefined }))
vi.hoisted(() => document.documentElement.style.setProperty('--paper', '#ffd18a'))

vi.mock('@/lib/db', () => ({ loadGameSelection: vi.fn(), saveClassicGameDefinition: vi.fn().mockResolvedValue(undefined), saveGameSelection: vi.fn().mockResolvedValue(undefined), clearGameSelection: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { count?: number }) => {
  if (key === 'classic.errors') return `${values?.count} errors`
  if (key === 'classic.mistakes') return `${values?.count} mistakes`
  return key
} }) }))
vi.mock('./ClassicPauseDialog', () => ({
  ClassicPauseDialog: ({ onQuitWithoutSaving, onSaveAndQuit, open }: { onQuitWithoutSaving: () => void; onSaveAndQuit: () => void; open: boolean }) => open ? <>
    <button onClick={onSaveAndQuit}>Save and quit</button>
    <button onClick={onQuitWithoutSaving}>Quit without saving</button>
  </> : null,
}))
vi.mock('./CorrectGameDialog', () => ({ CorrectGameDialog: ({ onOpenChange, open, screenshot }: { onOpenChange: (open: boolean) => void; open: boolean; screenshot: string | null }) => open ? <output data-testid="completion-dialog" data-screenshot={screenshot}>Open<button onClick={() => onOpenChange(false)}>Cancel completion</button></output> : null }))
// Exercise the real React interaction state; only replace the Pixi drawing surface.
vi.mock('./GameGridCanvas', () => ({
  GameGridCanvas: (props: ComponentProps<typeof GameGridCanvas>) => {
    canvasMock.props = props
    useImperativeHandle(props.ref, () => ({ captureBoard: canvasMock.captureBoard, clientToCell: canvasMock.clientToCell, resetView: () => undefined }), [])
    useEffect(() => { if (canvasMock.autoReady) props.onReady?.() }, [props.onReady])
    const piece = props.pieces[0]
    const cell = piece?.cells[0]
    const key = cell ? `${cell.x},${cell.y}` : ''
    const lockedGroup = props.lockedCellGroups.find((group) => group.cellKeys.includes(key))
    return <div>
      {props.pieces.flatMap((piece) => piece.cells.map(({ x, y }) => (
        <button key={`${x},${y}`} onClick={() => props.onToggle(`${x},${y}`, performance.now())}>{`Cell ${x},${y}`}</button>
      )))}
      <button onClick={() => props.onToggle('6,5', performance.now())}>Empty cell</button>
      <button onClick={props.onNavigate}>Navigate grid</button>
      {cell && <button onClick={() => props.onCellExit?.({
        cell,
        cellKey: key,
        piece,
        pieceCellKeys: piece.cells.map(({ x, y }) => `${x},${y}`),
        pieceId: piece.id,
        pieceKind: piece.kind,
        locked: lockedGroup !== undefined,
        lockedHasUniqueCorners: false,
        lockedGroupId: lockedGroup?.id ?? null,
        selected: props.selectedCellKeys.has(key) || lockedGroup?.id === props.selectedLockedGroupId,
      })}>Exit first cell</button>}
      <output data-testid="board-state">{JSON.stringify({
        locked: props.lockedCellGroups,
        selected: [...props.selectedCellKeys],
        selectedLockedGroupId: props.selectedLockedGroupId,
        markers: [...props.markers.keys()],
      })}</output>
    </div>
  },
}))

const pieces: PlacedTetromino[] = [0, 3].map((offset, id) => ({
  id,
  kind: 'O',
  cells: [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], index) => ({
    x: x + offset, y, corner: CELL_CORNERS[index], cellId: (['a', 'b', 'c', 'd'] as const)[index],
  })),
}))
const firstSquare = ['0,0', '1,0', '0,1', '1,1']
const secondSquare = ['3,0', '4,0', '3,1', '4,1']

function emptySave(): GameSelectionState {
  return { completionResult: null, selectedCellKeys: [], lockedCellGroups: [], markers: [], moveCount: 0, unlockCount: 0, elapsedSeconds: 0, gameGridScreenshot: null, savedAt: null, isCompleted: false }
}

function board() {
  return JSON.parse(screen.getByTestId('board-state').textContent!) as {
    locked: GameSelectionState['lockedCellGroups']; selected: string[]; markers: string[]; selectedLockedGroupId: string | null
  }
}

function CurrentPath() {
  const location = useLocation()
  return <output data-testid="current-path">{`${location.pathname}${location.search}`}</output>
}

function tap(...keys: string[]) {
  for (const key of keys) fireEvent.click(screen.getByRole('button', { name: `Cell ${key}` }))
}

function finishVerificationWave() {
  const { verificationRequest, onVerificationComplete } = canvasMock.props!
  expect(verificationRequest).toBeDefined()
  act(() => onVerificationComplete?.(verificationRequest!.id))
}

function confirmRestart() {
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'common.restart' }))
}

type GridProps = ComponentProps<typeof GameGrid>
function gridElement(props: GridProps) {
  return <StrictMode><MemoryRouter><ToastProvider><GameGrid {...props} /></ToastProvider></MemoryRouter></StrictMode>
}

function setup(lockingMode: 'auto' | 'manual' = 'auto', overrides: Partial<GridProps> = {}) {
  const props: GridProps = {
    config: { ...GAME_CONFIGS.c003, lockingMode, finalVerificationMode: 'manual', completionScreenshotDelayMs: 0 },
    gameMode: 'c003', gameId: 'locking-test', pieces, persistSelection: false, paused: false,
    onElapsedSecondsChange: vi.fn(), onMoveCountChange: vi.fn(), onNextGame: vi.fn(),
    onPauseOpenChange: vi.fn(), onLocked: vi.fn(), onLockAvailable: vi.fn(), onVerifyAvailable: vi.fn(), onCorrectSolution: vi.fn(),
    ...overrides,
  }
  const view = render(gridElement(props))
  return { props, rerender: (updates: Partial<GridProps>) => view.rerender(gridElement({ ...props, ...updates })) }
}

let time: number
beforeEach(() => {
  vi.clearAllMocks()
  canvasMock.autoReady = true
  canvasMock.clientToCell.mockReset()
  canvasMock.captureBoard.mockReturnValue({ toDataURL: () => 'data:image/png;base64,clean-board' })
  time = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => time)
  vi.mocked(loadGameSelection).mockResolvedValue(emptySave())
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Classic locking modes', () => {
  it('disables the expanded board fade when requested and restores it afterward', async () => {
    const view = setup('auto', { edgeFadeEnabled: true })
    await waitFor(() => expect(canvasMock.props?.interactive).toBe(true))
    expect(canvasMock.props?.edgeFadeEnabled).toBe(true)
    view.rerender({ edgeFadeEnabled: false })
    expect(canvasMock.props?.edgeFadeEnabled).toBe(false)
    view.rerender({ edgeFadeEnabled: true })
    expect(canvasMock.props?.edgeFadeEnabled).toBe(true)
  })

  it('exposes hit testing against the actual board and disables it while paused', async () => {
    const boardHitTestRef: { current: ((point: { clientX: number; clientY: number }) => boolean | null) | null } = { current: null }
    const view = setup('auto', { boardHitTestRef })
    await waitFor(() => expect(canvasMock.props?.interactive).toBe(true))
    const point = { clientX: 20, clientY: 30 }
    canvasMock.clientToCell.mockReturnValue({ column: 0, row: 0 })
    expect(boardHitTestRef.current?.(point)).toBe(true)
    canvasMock.clientToCell.mockReturnValue({ column: -1, row: 0 })
    expect(boardHitTestRef.current?.(point)).toBe(false)
    canvasMock.clientToCell.mockReturnValue({ column: GAME_CONFIGS.c003.columns, row: 0 })
    expect(boardHitTestRef.current?.(point)).toBe(false)
    canvasMock.clientToCell.mockReturnValue(null)
    expect(boardHitTestRef.current?.(point)).toBeNull()
    view.rerender({ paused: true })
    expect(boardHitTestRef.current?.(point)).toBeNull()
  })

  it('loads behind a delayed entrance before sliding the grid into view', async () => {
    vi.useFakeTimers()
    canvasMock.autoReady = false
    const onEntranceAnimationComplete = vi.fn()
    setup('auto', { entranceAnimation: true, onEntranceAnimationComplete })

    const entrance = screen.getByLabelText('Game board').closest('.game-grid-entrance')!
    expect(entrance.getAttribute('data-revealed')).toBeNull()
    expect(canvasMock.props!.interactive).toBe(false)
    expect(canvasMock.props!.edgeFadeEnabled).toBe(false)

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(entrance.getAttribute('data-revealed')).toBeNull()
    expect(onEntranceAnimationComplete).not.toHaveBeenCalled()

    act(() => canvasMock.props!.onReady?.())
    expect(entrance.getAttribute('data-revealed')).toBe('true')
    expect(canvasMock.props!.interactive).toBe(true)
    expect(canvasMock.props!.edgeFadeEnabled).toBe(false)
    for (const type of ['animationend', 'webkitAnimationEnd']) {
      const animationEnd = new Event(type, { bubbles: true })
      Object.defineProperty(animationEnd, 'animationName', { value: 'game-grid-slide-up' })
      fireEvent(entrance, animationEnd)
    }
    expect(onEntranceAnimationComplete).toHaveBeenCalledOnce()
    expect(canvasMock.props!.edgeFadeEnabled).toBe(true)
  })

  it('completes the entrance immediately after the board is ready with reduced motion', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    try {
      canvasMock.autoReady = false
      const onEntranceAnimationComplete = vi.fn()
      setup('auto', { entranceAnimation: true, onEntranceAnimationComplete })
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
      expect(onEntranceAnimationComplete).not.toHaveBeenCalled()
      act(() => canvasMock.props!.onReady?.())
      expect(canvasMock.props!.edgeFadeEnabled).toBe(true)
      expect(onEntranceAnimationComplete).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('disables canvas interaction when a tutorial step marks the board non-interactive', async () => {
    setup('auto', { boardInteractive: false })

    await waitFor(() => expect(canvasMock.props?.interactive).toBe(false))
  })

  it('locks and unlocks level 2 cells through the active tutorial highlight', async () => {
    const definition = level2.data as ClassicGameDefinition
    const onUnlocked = vi.fn()
    const { props } = setup('auto', {
      boardInteractive: true,
      config: definition.config,
      pieces: definition.pieces,
      onUnlocked,
      highlightAreas: [{ id: 'level-2-highlight', left: 0, top: 4, width: 3, height: 2 }],
    })
    await waitFor(() => expect(canvasMock.props?.interactive).toBe(true))
    const highlight = document.getElementById('level-2-highlight')!
    highlight.classList.add('driver-active-element')
    // A screen-sized canvas starts at (0, 0), but this zoomed and panned board
    // starts at (40, 100). The highlighted cells must use the grid transform.
    const metrics = getGridMetrics({ infinite: false, columns: 6, rows: 6 }, {
      width: 300, height: 300, cellSize: 50, fit: 'manual', zoom: 1.5, offsetX: -20, offsetY: -30,
    })
    canvasMock.clientToCell.mockImplementation(({ clientX, clientY }) => screenToGridCell(metrics, clientX - 40, clientY - 100))
    const tapCell = (column: number, row: number) => {
      const clientX = 40 + metrics.offsetX + (column + 0.5) * metrics.cellWidth
      const clientY = 100 + metrics.offsetY + (row + 0.5) * metrics.cellHeight
      fireEvent(highlight, new MouseEvent('pointerup', { bubbles: true, clientX, clientY }))
    }

    for (const [column, row] of [[0, 4], [1, 4], [1, 5], [2, 5]]) tapCell(column, row)
    expect(board().locked[0].cellKeys).toEqual(['0,4', '1,4', '1,5', '2,5'])
    expect(props.onLocked).toHaveBeenCalledOnce()
    tapCell(0, 4)
    tapCell(0, 4)
    expect(board().locked).toHaveLength(0)
    expect(onUnlocked).toHaveBeenCalledOnce()
  })

  it('forwards configured Career rendering to the canvas', () => {
    setup('auto', { emptyCellBorderOpacity: 0.5, emptyCellOpacity: 0.25, showCornerMarkers: false })

    expect(canvasMock.props?.emptyCellBorderOpacity).toBe(0.5)
    expect(canvasMock.props?.emptyCellOpacity).toBe(0.25)
    expect(canvasMock.props?.showCornerMarkers).toBe(false)
  })

  it.each(['auto', 'manual'] as const)('captures before the wave and waits for renderer completion with %s verification', async (finalVerificationMode) => {
    vi.useFakeTimers()
    try {
      const onCorrectVerification = vi.fn()
      setup('auto', {
        config: { ...GAME_CONFIGS.c003, completionScreenshotDelayMs: 200, finalVerificationMode },
        onCorrectSolution: undefined,
        onCorrectVerification,
      })
      tap(...firstSquare, ...secondSquare)
      if (finalVerificationMode === 'manual') fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
      expect(onCorrectVerification).toHaveBeenCalledOnce()
       expect(screen.queryByTestId('completion-dialog')).toBeNull()
       expect(canvasMock.captureBoard).not.toHaveBeenCalled()
      expect(canvasMock.props!.verificationRequest).toBeUndefined()

      await act(async () => { await vi.advanceTimersByTimeAsync(199) })
      expect(canvasMock.captureBoard).not.toHaveBeenCalled()
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
       expect(canvasMock.props!.verificationRequest).toMatchObject({ isCorrect: true })
      expect(canvasMock.props!.verificationRequest!.incorrectCellKeys.size).toBe(0)
      const waveId = canvasMock.props!.verificationRequest!.id
      fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
      tap(firstSquare[0], firstSquare[0])
      expect(board().locked).toHaveLength(2)
      expect(canvasMock.props!.verificationRequest!.id).toBe(waveId)
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
       expect(screen.queryByTestId('completion-dialog')).toBeNull()
       finishVerificationWave()
       expect(screen.getByTestId('completion-dialog').textContent).toContain('Open')
       expect(screen.getByTestId('completion-dialog').getAttribute('data-screenshot')).toBe('data:image/png;base64,clean-board')
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for the completion screenshot delay before drawing an incorrect wave', async () => {
    vi.useFakeTimers()
    try {
      const incorrectPieces: PlacedTetromino[] = pieces.map((piece, index) => index === 1
        ? { ...piece, cells: piece.cells.map((cell) => ({ ...cell, corner: 'top-left' as const })) }
        : piece)
      const onCorrectVerification = vi.fn()
      setup('auto', {
        config: { ...GAME_CONFIGS.c003, completionScreenshotDelayMs: 200, finalVerificationMode: 'manual' },
        pieces: incorrectPieces,
        onCorrectVerification,
      })
      tap(...firstSquare, ...secondSquare)
      fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
      expect(onCorrectVerification).not.toHaveBeenCalled()
      expect(canvasMock.props!.verificationRequest).toBeUndefined()
      expect(canvasMock.captureBoard).not.toHaveBeenCalled()

      await act(async () => { await vi.advanceTimersByTimeAsync(199) })
      expect(canvasMock.props!.verificationRequest).toBeUndefined()
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(canvasMock.props!.verificationRequest).toMatchObject({ isCorrect: false })
      expect(canvasMock.props!.verificationRequest!.incorrectCellKeys).toEqual(new Set(secondSquare))
      expect(canvasMock.captureBoard).not.toHaveBeenCalled()
      const requestId = canvasMock.props!.verificationRequest!.id
      finishVerificationWave()
      expect(canvasMock.props!.verificationRequest!.id).toBe(requestId)
      expect(canvasMock.props!.interactive).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'classic.revealBoard' }))
      expect(canvasMock.props!.verificationRestoring).toBe(true)
      act(() => canvasMock.props!.onVerificationRestored?.(requestId))
      expect(canvasMock.props!.verificationRequest).toBeUndefined()
      expect(board().locked).toHaveLength(2)
      expect(board().selectedLockedGroupId).toBeNull()
      tap(secondSquare[0], secondSquare[0])
      expect(board().locked).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['auto', 'manual'] as const)('immediately leaves repeated-corner groups unlocked with %s locking', (lockingMode) => {
    const repeatedCorners: PlacedTetromino[] = [{ ...pieces[0], cells: pieces[0].cells.map((cell) => ({ ...cell, corner: 'top-left' })) }]
    const { props } = setup(lockingMode, { config: { ...GAME_CONFIGS.c003, lockingMode, unlockRepeatedCornerLocks: true }, pieces: repeatedCorners })
    tap(...firstSquare)
    if (lockingMode === 'manual') fireEvent.click(screen.getByRole('button', { name: 'Lock four selected cells' }))
    expect(board().locked).toEqual([])
    expect(board().selected).toEqual(firstSquare)
    expect(props.onLocked).not.toHaveBeenCalled()
    expect(canvasMock.props!.verificationRequest).toBeUndefined()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps repeated-corner groups lockable when immediate unlocking is disabled', () => {
    const repeatedCorners: PlacedTetromino[] = [{ ...pieces[0], cells: pieces[0].cells.map((cell) => ({ ...cell, corner: 'top-left' })) }]
    const { props } = setup('auto', { pieces: repeatedCorners })
    tap(...firstSquare)
    expect(board().locked).toHaveLength(1)
    expect(props.onLocked).toHaveBeenLastCalledWith(expect.objectContaining({ cellKeys: firstSquare }), false)
  })

  it('can skip verification animation for immediate correct results', () => {
    const config = { ...GAME_CONFIGS.c003, completionAnimationEnabled: false, completionScreenshotDelayMs: 0, finalVerificationMode: 'manual' as const }
    const onCorrectVerification = vi.fn()
    const { props } = setup('auto', { config, onCorrectVerification })
    tap(...firstSquare, ...secondSquare)
    fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
    expect(canvasMock.props!.verificationRequest).toBeUndefined()
    expect(props.onCorrectSolution).toHaveBeenCalledOnce()
    expect(onCorrectVerification).toHaveBeenCalledOnce()

  })

  it('records computed completion progress for a successful game', async () => {
    const result = { bonusPercentage: 0, perfectionPercentage: 100 }
    const getCompletionResult = vi.fn(() => result)
    const onGameCompleted = vi.fn()
    const config = { ...GAME_CONFIGS.c003, completionAnimationEnabled: false, completionScreenshotDelayMs: 0, finalVerificationMode: 'manual' as const }
    setup('auto', {
      config,
      getCompletionResult,
      onCorrectSolution: undefined,
      onGameCompleted,
      persistSelection: true,
    })

    await waitFor(() => expect(canvasMock.props?.interactive).toBe(true))
    tap(...firstSquare, ...secondSquare)
    fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))

    expect(getCompletionResult).toHaveBeenCalledWith(expect.any(Array), 0)
    expect(onGameCompleted).toHaveBeenCalledWith(result)
    await waitFor(() => expect(saveGameSelection).toHaveBeenLastCalledWith('c003', 'locking-test', expect.objectContaining({ completionResult: result })))
  })

  it.each(['flip', 'wave'] as const)('keeps a correctly verified board editable after dismissing its %s result', (verificationEffect) => {
    const { rerender } = setup('auto', { config: { ...GAME_CONFIGS.c003, verificationEffect, completionScreenshotDelayMs: 0, finalVerificationMode: 'manual' }, onCorrectSolution: undefined })
    tap(...firstSquare, ...secondSquare)
    fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
    const { verificationRequest, onVerificationComplete } = canvasMock.props!
    finishVerificationWave()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel completion' }))

    if (verificationEffect === 'flip') {
      expect(canvasMock.props!.verificationRequest!.id).toBe(verificationRequest!.id)
      expect(canvasMock.props!.interactive).toBe(false)
      // Duplicate notifications and pause/resume must neither reopen the dialog
      // nor turn the cards back over.
      act(() => onVerificationComplete?.(verificationRequest!.id))
      expect(screen.queryByTestId('completion-dialog')).toBeNull()
      rerender({ paused: true })
      fireEvent.click(screen.getByRole('button', { name: 'classic.revealBoard' }))
      expect(canvasMock.props!.verificationRequest!.id).toBe(verificationRequest!.id)
      rerender({ paused: false })
      fireEvent.click(screen.getByRole('button', { name: 'classic.revealBoard' }))
      expect(canvasMock.props!.verificationRestoring).toBe(true)
      expect(canvasMock.props!.interactive).toBe(false)
      act(() => canvasMock.props!.onVerificationRestored?.(verificationRequest!.id))
      expect(board().locked).toHaveLength(2)
      expect(board().selectedLockedGroupId).toBeNull()
    }
    expect(canvasMock.props!.verificationRequest).toBeUndefined()
    expect(canvasMock.props!.interactive).toBe(true)
    tap(firstSquare[0], firstSquare[0])
    expect(board().locked).toHaveLength(1)
  })

  it('cancels pending capture and ignores stale animation callbacks after a restart', async () => {
    vi.useFakeTimers()
    setup('auto', { config: { ...GAME_CONFIGS.c003, finalVerificationMode: 'auto', completionScreenshotDelayMs: 200 }, onCorrectSolution: undefined })
    tap(...firstSquare, ...secondSquare)
    fireEvent.click(screen.getByRole('button', { name: 'common.restart' }))
    confirmRestart()
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(canvasMock.captureBoard).not.toHaveBeenCalled()
    expect(canvasMock.props!.verificationRequest).toBeUndefined()

    tap(...firstSquare, ...secondSquare)
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    const { verificationRequest, onVerificationComplete } = canvasMock.props!
    fireEvent.click(screen.getByRole('button', { name: 'common.restart' }))
    confirmRestart()
    act(() => onVerificationComplete?.(verificationRequest!.id))
    expect(board().locked).toEqual([])
    expect(canvasMock.props!.verificationRequest).toBeUndefined()
    expect(screen.queryByTestId('completion-dialog')).toBeNull()
  })

  it('hides the shared game controls when configured for a tutorial board', () => {
    setup('auto', { config: { ...GAME_CONFIGS.c003, hideGameControls: true } })
    expect(screen.queryByRole('button', { name: 'common.restart' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Deselect all cells' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take notes' })).toBeNull()
  })

  it('keeps an unlocked selected cell selected when that cell exits Infinite', () => {
    const onCellExit = vi.fn()
    const scrolling = { firstRow: 0, visibleRows: 6, getOffsetRows: () => 0, advance: vi.fn() }
    setup('auto', { onCellExit, scrolling })
    tap(firstSquare[0], firstSquare[1])
    expect(board().selected).toEqual(firstSquare.slice(0, 2))

    fireEvent.click(screen.getByRole('button', { name: 'Exit first cell' }))
    expect(board().selected).toEqual(firstSquare.slice(0, 2))
    expect(onCellExit).toHaveBeenCalledWith(expect.objectContaining({
      cellKey: firstSquare[0], locked: false, selected: true, pieceId: pieces[0].id,
    }))
  })

  it('does not deselect a locked group when one of its cells exits Infinite', () => {
    const scrolling = { firstRow: 0, visibleRows: 6, getOffsetRows: () => 0, advance: vi.fn() }
    setup('auto', { scrolling })
    tap(...firstSquare, firstSquare[0])
    const selectedGroupId = board().selectedLockedGroupId
    expect(selectedGroupId).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Exit first cell' }))
    expect(board().selectedLockedGroupId).toBe(selectedGroupId)
    expect(board().locked).toHaveLength(1)
  })

  it('keeps Infinite playable after all current pieces lock and prunes only recycled cells', () => {
    const scrolling = { firstRow: 0, visibleRows: 6, getOffsetRows: () => 0, advance: vi.fn() }
    const { props, rerender } = setup('auto', {
      config: { ...GAME_CONFIGS.c003, lockingMode: 'auto', finalVerificationMode: 'auto' }, scrolling,
    })
    tap(...firstSquare, ...secondSquare)
    expect(board().locked).toHaveLength(2)
    expect(props.onCorrectSolution).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'classic.verify' })).toBeNull()
    tap(secondSquare[0])
    const selectedGroup = board().selectedLockedGroupId
    expect(selectedGroup).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Take notes' }))
    tap(firstSquare[0], secondSquare[0])
    rerender({ pieces: [pieces[1]] })
    expect(board().locked).toHaveLength(1)
    expect(board().locked[0].cellKeys).toEqual(secondSquare)
    expect(board().selectedLockedGroupId).toBe(selectedGroup)
    expect(board().markers).toEqual([secondSquare[0]])
    expect(saveGameSelection).not.toHaveBeenCalled()
  })

  it('cancels a pending double-tap unlock after moving or zooming the grid', () => {
    setup()
    tap(...firstSquare, '0,0')
    fireEvent.click(screen.getByRole('button', { name: 'Navigate grid' }))
    tap('0,0')
    expect(board().locked).toHaveLength(1)
    tap('1,0')
    expect(board().locked).toHaveLength(0)
  })

  it('restarts from the control panel with the same reset flow as the pause menu', () => {
    const { props } = setup()
    tap(...firstSquare)
    expect(board().locked).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'common.restart' }))
    expect(board().locked).toHaveLength(1)
    confirmRestart()
    expect(board().locked).toEqual([])
    expect(board().selected).toEqual([])
    expect(props.onPauseOpenChange).toHaveBeenCalledWith(false)
  })

  it('locks once on the fourth selection and counts one move, including in Strict Mode', () => {
    const { props } = setup()
    expect(screen.queryByRole('button', { name: 'Lock four selected cells' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unlock selected cells' })).toBeNull()
    tap(...firstSquare.slice(0, 3))
    expect(board().locked).toHaveLength(0)
    tap(firstSquare[3])
    expect(board().locked).toHaveLength(1)
    expect(board().locked[0].cellKeys).toEqual(firstSquare)
    expect(board().selected).toEqual([])
    expect(props.onLocked).toHaveBeenCalledTimes(1)
    expect(props.onLocked).toHaveBeenLastCalledWith(expect.objectContaining({ cellKeys: firstSquare }), true)
    expect(props.onMoveCountChange).toHaveBeenLastCalledWith(1)
  })

  it('keeps invalid selections editable and locks when removing an extra cell leaves a valid four', () => {
    setup()
    tap('0,0', '1,0', '0,1', '3,0')
    expect(board().selected).toHaveLength(4)
    expect(board().locked).toHaveLength(0)
    tap('1,1')
    expect(board().selected).toHaveLength(5)
    expect(board().locked).toHaveLength(0)
    tap('3,0')
    expect(board().locked[0].cellKeys).toEqual(firstSquare)
  })

  it('automatically locks the latest valid four while preserving older selections in order', () => {
    setup()
    tap('0,0', '1,0')
    tap(...secondSquare)
    expect(board().locked).toHaveLength(1)
    expect(board().locked[0].cellKeys).toEqual(secondSquare)
    expect(board().selected).toEqual(['0,0', '1,0'])

    // Re-selecting moves a cell to the newest position, so it participates in
    // the next four-cell window without disturbing the older remaining cell.
    tap('0,0', '0,0', '0,1', '1,1')
    expect(board().locked).toHaveLength(2)
    expect(board().locked[1].cellKeys).toEqual(['1,0', '0,0', '0,1', '1,1'])
    expect(board().selected).toEqual([])
  })

  it('does not auto-lock an older valid subset when the latest four are invalid', () => {
    setup()
    // The first square is present as a subset, but its cells were interleaved
    // with distant cells and were never the four newest selections together.
    tap('0,0', '3,0', '1,0', '4,0', '0,1', '3,1', '1,1')
    expect(board().locked).toHaveLength(0)
    expect(board().selected).toEqual(['0,0', '3,0', '1,0', '4,0', '0,1', '3,1', '1,1'])
  })

  it('requires the explicit Verify action even when all automatically locked groups are correct', () => {
    const { props } = setup()
    tap(...firstSquare, ...secondSquare)
    expect(board().locked).toHaveLength(2)
    expect(props.onMoveCountChange).toHaveBeenLastCalledWith(2)
    expect(props.onCorrectSolution).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
    finishVerificationWave()
    expect(props.onCorrectSolution).toHaveBeenCalledOnce()
  })

  it('automatically verifies a fully locked board when configured', async () => {
    const { props } = setup('auto', { config: { ...GAME_CONFIGS.c003, lockingMode: 'auto', finalVerificationMode: 'auto', completionScreenshotDelayMs: 0 } })
    tap(...firstSquare, ...secondSquare)
    expect(props.onCorrectSolution).not.toHaveBeenCalled()
    finishVerificationWave()
    await waitFor(() => expect(props.onCorrectSolution).toHaveBeenCalledOnce())
    const verifyButton = screen.getByRole('button', { name: 'classic.verify' })
    expect(verifyButton).toBeTruthy()
    expect(verifyButton.hasAttribute('disabled')).toBe(false)
    fireEvent.click(verifyButton)
    finishVerificationWave()
    expect(props.onCorrectSolution).toHaveBeenCalledTimes(2)
  })

  it('unlocks the entire group on two quick taps on cells within that group', () => {
    const { props } = setup('auto', { onUnlockCountChange: vi.fn(), onUnlocked: vi.fn() })
    tap(...firstSquare)
    tap('1,1') // The fourth selection must not have started a double-tap gesture.
    expect(board().locked).toHaveLength(1)
    time += 150
    tap('0,0')
    expect(board().locked).toHaveLength(0)
    expect(board().selected).toEqual([])
    expect(props.onMoveCountChange).toHaveBeenLastCalledWith(1)
    expect(props.onUnlockCountChange).toHaveBeenLastCalledWith(1)
    expect(props.onUnlocked).toHaveBeenLastCalledWith(expect.objectContaining({ cellKeys: firstSquare }), true)
    expect(props.onUnlocked).toHaveBeenCalledOnce()
    tap('0,0') // No leftover gesture or automatic re-lock after unlocking.
    expect(board().selected).toEqual(['0,0'])
  })

  it('does not combine slow taps or taps on different locked groups', () => {
    setup()
    tap(...firstSquare, ...secondSquare)
    tap('0,0')
    time += 500
    tap('0,0')
    expect(board().locked).toHaveLength(2)
    tap('3,0', '0,0')
    expect(board().locked).toHaveLength(2)
    tap('1,0')
    expect(board().locked).toHaveLength(1)
    expect(board().locked[0].cellKeys).toEqual(secondSquare)
  })

  it('resets the unlock gesture on empty-cell taps and deselection', () => {
    setup()
    tap(...firstSquare, '0,0')
    fireEvent.click(screen.getByRole('button', { name: 'Empty cell' }))
    tap('0,0')
    expect(board().locked).toHaveLength(1)
    time += 500
    tap('0,0')
    fireEvent.click(screen.getByRole('button', { name: 'Deselect all cells' }))
    tap('0,0')
    expect(board().locked).toHaveLength(1)
  })

  it('keeps note input independent of automatic locking and double-tap unlocking', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Take notes' }))
    tap(...firstSquare)
    expect(board().markers).toEqual(firstSquare)
    expect(board().locked).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Take notes' }))
    tap(...firstSquare, '0,0')
    fireEvent.click(screen.getByRole('button', { name: 'Take notes' }))
    tap('0,0', '0,0')
    expect(board().locked).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Take notes' }))
    tap('0,0')
    expect(board().locked).toHaveLength(1)
  })

  it('toggles a note on long press without changing selection or entering note mode', () => {
    const { rerender } = setup()
    tap('0,0')
    act(() => canvasMock.props!.onLongPress?.('1,0'))
    expect(board().selected).toEqual(['0,0'])
    expect(board().markers).toEqual(['1,0'])
    expect(screen.getByRole('button', { name: 'Take notes' }).getAttribute('aria-pressed')).toBe('false')
    act(() => canvasMock.props!.onLongPress?.('1,0'))
    act(() => canvasMock.props!.onLongPress?.('6,5'))
    expect(board().markers).toEqual([])
    rerender({ paused: true })
    act(() => canvasMock.props!.onLongPress?.('1,0'))
    expect(board().markers).toEqual([])
  })

  it('ignores paused input and clears the pending double tap on pause', () => {
    const { rerender } = setup()
    tap(...firstSquare, '0,0')
    rerender({ paused: true })
    tap('0,0', '0,0')
    expect(board().locked).toHaveLength(1)
    rerender({ paused: false })
    tap('0,0')
    expect(board().locked).toHaveLength(1)
    tap('0,0')
    expect(board().locked).toHaveLength(0)
  })

  it('retains manual Lock/Unlock and ignores double taps in manual mode', () => {
    setup('manual')
    tap(...firstSquare)
    expect(board().locked).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Lock four selected cells' }))
    expect(board().locked).toHaveLength(1)
    tap('0,0', '0,0')
    expect(board().locked).toHaveLength(1)
    tap('1,0')
    fireEvent.click(screen.getByRole('button', { name: 'Unlock selected cells' }))
    expect(board().locked).toHaveLength(0)
  })

  it('supports switching configuration without discarding the current selection', () => {
    const { rerender } = setup('manual')
    tap(...firstSquare.slice(0, 3))
    rerender({ config: { ...GAME_CONFIGS.c003, lockingMode: 'auto' } })
    tap(firstSquare[3])
    expect(board().locked).toHaveLength(1)
    rerender({ config: { ...GAME_CONFIGS.c003, lockingMode: 'manual' } })
    expect(screen.queryByRole('button', { name: 'Unlock selected cells' })).not.toBeNull()
    expect(board().locked).toHaveLength(1)
  })

  it('preserves manual tutorial callbacks and resets locks for the next scenario', () => {
    const { props, rerender } = setup('manual', { pieces: [pieces[0]], boardResetKey: 'first-lesson' })
    tap(...firstSquare)
    expect(props.onLockAvailable).toHaveBeenCalledOnce()
    expect(props.onLocked).not.toHaveBeenCalled()
    expect(props.onVerifyAvailable).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Lock four selected cells' }))
    expect(props.onLocked).toHaveBeenCalledOnce()
    expect(props.onVerifyAvailable).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
    finishVerificationWave()
    expect(props.onCorrectSolution).toHaveBeenCalledOnce()
    rerender({ pieces: [pieces[1]], boardResetKey: 'second-lesson' })
    expect(board().locked).toHaveLength(0)
    tap(...secondSquare)
    expect(board().locked).toHaveLength(0)
    expect(props.onLockAvailable).toHaveBeenCalledTimes(2)
    expect(saveGameSelection).not.toHaveBeenCalled()
  })

  it('restores legacy selections and saves automatic locks/unlocks in the existing format', async () => {
    vi.mocked(loadGameSelection).mockResolvedValue({ ...emptySave(), selectedCellKeys: firstSquare })
    setup('auto', { persistSelection: true })
    await waitFor(() => expect(board().selected).toEqual(firstSquare))
    tap('1,1', '1,1')
    await waitFor(() => expect(saveGameSelection).toHaveBeenLastCalledWith('c003', 'locking-test', expect.objectContaining({
      selectedCellKeys: [], moveCount: 1, lockedCellGroups: [expect.objectContaining({ cellKeys: firstSquare })],
    })))
    tap('0,0', '0,0')
    await waitFor(() => expect(saveGameSelection).toHaveBeenLastCalledWith('c003', 'locking-test', expect.objectContaining({
      selectedCellKeys: [], lockedCellGroups: [], moveCount: 1,
    })))
  })

  it.each(['Save and quit', 'Quit without saving'])('returns directly to Modes after %s, even with a duplicate seedless history entry', async (actionLabel) => {
    render(
      <MemoryRouter
        initialEntries={[
          '/play/modes',
          '/play?mode=c003',
          { pathname: '/play', search: '?mode=c003&seed=fresh-game', state: { returnToClassicMenu: true } },
        ]}
        initialIndex={2}
      >
        <ToastProvider>
          <GameGrid
            config={{ ...GAME_CONFIGS.c003, finalVerificationMode: 'manual' }}
            gameId="fresh-game"
            gameMode="c003"
            onElapsedSecondsChange={vi.fn()}
            onMoveCountChange={vi.fn()}
            onNextGame={vi.fn()}
            onPauseOpenChange={vi.fn()}
            paused
            persistSelection={false}
            pieces={pieces}
          />
        </ToastProvider>
        <CurrentPath />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: actionLabel }))
    await waitFor(() => expect(screen.getByTestId('current-path').textContent).toBe('/play/modes'))
  })
})
