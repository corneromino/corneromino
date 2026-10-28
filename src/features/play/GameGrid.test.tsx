// @vitest-environment jsdom
import { StrictMode, type ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CELL_CORNERS, GAME_CONFIGS, type GameSelectionState, type PlacedTetromino } from '@/game/gameConfig'
import { loadGameSelection, saveGameSelection } from '@/lib/db'
import type { GameGridCanvas } from './GameGridCanvas'
import { GameGrid } from './GameGrid'

vi.mock('@/lib/db', () => ({ loadGameSelection: vi.fn(), saveGameSelection: vi.fn().mockResolvedValue(undefined), clearGameSelection: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { count?: number }) => {
  if (key === 'classic.errors') return `${values?.count} errors`
  if (key === 'classic.mistakes') return `${values?.count} mistakes`
  return key
} }) }))
vi.mock('./ClassicPauseDialog', () => ({ ClassicPauseDialog: () => null }))
vi.mock('./CorrectGameDialog', () => ({ CorrectGameDialog: () => null }))
// Exercise the real React interaction state; only replace the Pixi drawing surface.
vi.mock('./GameGridCanvas', () => ({
  GameGridCanvas: (props: ComponentProps<typeof GameGridCanvas>) => {
    const corneromino = props.pieces[0]
    const cell = corneromino?.cells[0]
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
        corneromino,
        cornerominoCellKeys: corneromino.cells.map(({ x, y }) => `${x},${y}`),
        cornerominoId: corneromino.id,
        cornerominoKind: corneromino.kind,
        locked: lockedGroup !== undefined,
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
  return { selectedCellKeys: [], lockedCellGroups: [], markers: [], moveCount: 0, elapsedSeconds: 0, gameGridScreenshot: null, savedAt: null, isCompleted: false }
}

function board() {
  return JSON.parse(screen.getByTestId('board-state').textContent!) as {
    locked: GameSelectionState['lockedCellGroups']; selected: string[]; markers: string[]; selectedLockedGroupId: string | null
  }
}

function tap(...keys: string[]) {
  for (const key of keys) fireEvent.click(screen.getByRole('button', { name: `Cell ${key}` }))
}

type GridProps = ComponentProps<typeof GameGrid>
function gridElement(props: GridProps) {
  return <StrictMode><MemoryRouter><GameGrid {...props} /></MemoryRouter></StrictMode>
}

function setup(lockingMode: 'auto' | 'manual' = 'auto', overrides: Partial<GridProps> = {}) {
  const props: GridProps = {
    config: { ...GAME_CONFIGS.easy, lockingMode, finalVerificationMode: 'manual' },
    gameMode: 'easy', gameId: 'locking-test', pieces, persistSelection: false, paused: false,
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
  time = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => time)
  vi.mocked(loadGameSelection).mockResolvedValue(emptySave())
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Classic locking modes', () => {
  it('deselects an unlocked selected cell when that cell exits Infinite', () => {
    const onCellExit = vi.fn()
    const scrolling = { firstRow: 0, visibleRows: 6, getOffsetRows: () => 0, advance: vi.fn() }
    setup('auto', { onCellExit, scrolling })
    tap(firstSquare[0], firstSquare[1])
    expect(board().selected).toEqual(firstSquare.slice(0, 2))

    fireEvent.click(screen.getByRole('button', { name: 'Exit first cell' }))
    expect(board().selected).toEqual([firstSquare[1]])
    expect(onCellExit).toHaveBeenCalledWith(expect.objectContaining({
      cellKey: firstSquare[0], locked: false, selected: true, cornerominoId: pieces[0].id,
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
      config: { ...GAME_CONFIGS.easy, lockingMode: 'auto', finalVerificationMode: 'auto' }, scrolling,
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

  it('uses the manual shape rule and leaves corner correctness to Verify', () => {
    const repeatedCorners: PlacedTetromino[] = [{ ...pieces[0], cells: pieces[0].cells.map((cell) => ({ ...cell, corner: 'top-left' })) }]
    const { props } = setup('auto', { pieces: repeatedCorners })
    tap(...firstSquare)
    expect(board().locked).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
    expect(props.onCorrectSolution).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toContain('1 mistakes')
    fireEvent.click(screen.getByRole('button', { name: 'common.ok' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('requires the explicit Verify action even when all automatically locked groups are correct', () => {
    const { props } = setup()
    tap(...firstSquare, ...secondSquare)
    expect(board().locked).toHaveLength(2)
    expect(props.onMoveCountChange).toHaveBeenLastCalledWith(2)
    expect(props.onCorrectSolution).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'classic.verify' }))
    expect(props.onCorrectSolution).toHaveBeenCalledOnce()
  })

  it('automatically verifies a fully locked board when configured', async () => {
    const { props } = setup('auto', { config: { ...GAME_CONFIGS.easy, lockingMode: 'auto', finalVerificationMode: 'auto' } })
    tap(...firstSquare, ...secondSquare)
    await waitFor(() => expect(props.onCorrectSolution).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'classic.verify' })).toBeNull()
  })

  it('shows automatic verification mistakes in a dialog instead of the controls', async () => {
    const repeatedCorners: PlacedTetromino[] = [{ ...pieces[0], cells: pieces[0].cells.map((cell) => ({ ...cell, corner: 'top-left' })) }]
    setup('auto', { pieces: repeatedCorners, config: { ...GAME_CONFIGS.easy, lockingMode: 'auto', finalVerificationMode: 'auto' } })
    tap(...firstSquare)
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('1 mistakes'))
    expect(screen.getByRole('button', { name: 'common.ok' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'classic.verify' })).toBeNull()
  })

  it('unlocks the entire group on two quick taps on cells within that group', () => {
    const { props } = setup()
    tap(...firstSquare)
    tap('1,1') // The fourth selection must not have started a double-tap gesture.
    expect(board().locked).toHaveLength(1)
    time += 150
    tap('0,0')
    expect(board().locked).toHaveLength(0)
    expect(board().selected).toEqual([])
    expect(props.onMoveCountChange).toHaveBeenLastCalledWith(1)
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
    rerender({ config: { ...GAME_CONFIGS.easy, lockingMode: 'auto' } })
    tap(firstSquare[3])
    expect(board().locked).toHaveLength(1)
    rerender({ config: { ...GAME_CONFIGS.easy, lockingMode: 'manual' } })
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
    await waitFor(() => expect(saveGameSelection).toHaveBeenLastCalledWith('easy', 'locking-test', expect.objectContaining({
      selectedCellKeys: [], moveCount: 1, lockedCellGroups: [expect.objectContaining({ cellKeys: firstSquare })],
    })))
    tap('0,0', '0,0')
    await waitFor(() => expect(saveGameSelection).toHaveBeenLastCalledWith('easy', 'locking-test', expect.objectContaining({
      selectedCellKeys: [], lockedCellGroups: [], moveCount: 1,
    })))
  })
})
