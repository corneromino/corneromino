// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GAME_CONFIGS, type PlacedTetromino } from '@/game/gameConfig'
import { careerLevels } from './careerLevels'

const gameGridProps = vi.hoisted(() => ({ current: undefined as {
  exitPath?: string
  gameDefinition?: { seed: string }
  gameId: string
  boardInteractive?: boolean
  hideGameControls?: boolean
  highlightAreas?: readonly { height: number; id: string; left: number; top: number; width: number }[]
  onLocked?: () => void
  onSelected?: () => void
  pieces: readonly PlacedTetromino[]
  persistSelection?: boolean
  tutorialControlIds?: { reset?: string }
} | undefined }))
const tutorialDriverMock = vi.hoisted(() => ({ destroy: vi.fn(), drive: vi.fn(), moveTo: vi.fn() }))
const initialCareerLevels = [...careerLevels]

vi.mock('@/lib/db', () => ({ clearGameSelection: vi.fn(), loadClassicGameDefinition: vi.fn(), saveClassicGameDefinition: vi.fn() }))
vi.mock('@/game/placementV2', () => ({ generateTetrominoPlacementsV2: vi.fn() }))
vi.mock('@/components/tutorial/createTutorialDriver', () => ({ createTutorialDriver: vi.fn(() => tutorialDriverMock) }))
vi.mock('../main-menu/TetrominoBackground', () => ({ TetrominoBackground: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { number?: number }) => key === 'career.level' ? `LEVEL ${values?.number}` : key }) }))
vi.mock('./GameGrid', () => ({
  GameGrid: (props: typeof gameGridProps.current extends infer Props ? NonNullable<Props> : never) => {
    gameGridProps.current = props
    return <output data-testid="game-grid">{props.pieces.length}</output>
  },
}))
vi.mock('./ClassicShapesDialog', () => ({ ClassicShapesDialog: () => null }))

import { clearGameSelection, loadClassicGameDefinition, saveClassicGameDefinition } from '@/lib/db'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { Play } from './Play'

const pieces: readonly PlacedTetromino[] = [{
  cells: [
    { cellId: 'a', corner: 'top-left', x: 0, y: 0 },
    { cellId: 'b', corner: 'top-right', x: 1, y: 0 },
    { cellId: 'c', corner: 'bottom-right', x: 0, y: 1 },
    { cellId: 'd', corner: 'bottom-left', x: 1, y: 1 },
  ],
  id: 1,
  kind: 'O',
}]

function renderPlay(seed: string, gameMode = 'c001') {
  return render(<MemoryRouter initialEntries={[`/play?mode=${gameMode}&seed=${seed}`]}><Play /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(performance.now())
    return 1
  })
  gameGridProps.current = undefined
})

afterEach(() => {
  cleanup()
  careerLevels.splice(0, careerLevels.length, ...initialCareerLevels)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('loads a stored board definition without running the seed generator', async () => {
  const definition = { config: { ...GAME_CONFIGS.c001 }, gameMode: 'c001' as const, pieces, seed: 'saved-board', version: 1 as const }
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(definition)

  renderPlay('saved-board')

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(generateTetrominoPlacementsV2).not.toHaveBeenCalled()
  expect(gameGridProps.current?.gameDefinition).toEqual(expect.objectContaining({ ...definition, bonus: expect.any(Array) }))
  expect(saveClassicGameDefinition).toHaveBeenCalledWith(gameGridProps.current?.gameDefinition)
})

it('shows a custom board name instead of its original difficulty title', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue({
    config: { ...GAME_CONFIGS.c003 },
    customName: 'My saved board',
    gameMode: 'c003',
    pieces,
    seed: 'custom-board',
    source: 'custom',
    version: 1,
  })

  renderPlay('custom-board', 'c003')

  await waitFor(() => expect(screen.getByText('My saved board')).toBeTruthy())
  expect(screen.queryByText('difficulty.medium')).toBeNull()
})

it('plays a Career level from its authored data using its stable career save ID', async () => {
  careerLevels.splice(0, careerLevels.length, {
    data: {
      config: { ...GAME_CONFIGS.c003 },
      customName: 'Ignored custom title',
      gameMode: 'c003',
      pieces,
      seed: 'authored-career-board',
      source: 'custom',
      version: 1,
    },
    x: 12,
    y: 34,
  })

  render(<MemoryRouter initialEntries={['/play?career=authored-career-board']}><Play /></MemoryRouter>)

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(screen.getByText('LEVEL 1')).toBeTruthy()
  expect(gameGridProps.current).toMatchObject({
    exitPath: '/',
    gameDefinition: { seed: 'career:authored-career-board' },
    gameId: 'career:authored-career-board',
  })
  expect(generateTetrominoPlacementsV2).not.toHaveBeenCalled()
})

it('maps authored Career tutorial board areas and advances from a cell selection', async () => {
  careerLevels.splice(0, careerLevels.length, {
    data: {
      config: { ...GAME_CONFIGS.c003 },
      gameMode: 'c003',
      pieces,
      seed: 'tutorial-career-board',
      version: 1,
    },
    tutorial: {
      steps: [{
        advanceOn: ['select'],
        area: 'board',
        boardInteractive: true,
        columns: 2,
        content: 'Lock this shape.',
        rows: 2,
        showUI: false,
        x: 0,
        y: 0,
      }, {
        area: 'reset',
        content: 'Restart the board.',
        showUI: true,
      }],
    },
    x: 0,
    y: 0,
  })

  render(<MemoryRouter initialEntries={['/play?career=tutorial-career-board']}><Play /></MemoryRouter>)

  await waitFor(() => expect(tutorialDriverMock.drive).toHaveBeenCalledWith(0))
  expect(gameGridProps.current).toMatchObject({
    boardInteractive: true,
    hideGameControls: true,
    highlightAreas: [{ height: 2, id: 'career-tutorial-board-0', left: 0, top: 0, width: 2 }],
    persistSelection: false,
    tutorialControlIds: { reset: 'career-tutorial-reset' },
  })
  expect(clearGameSelection).toHaveBeenCalledWith('c003', 'career:tutorial-career-board')

  gameGridProps.current?.onSelected?.()
  await waitFor(() => expect(tutorialDriverMock.moveTo).toHaveBeenCalledWith(1))
})

it('uses the seed generator for a legacy save with no board definition', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  renderPlay('legacy-seed')

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(generateTetrominoPlacementsV2).toHaveBeenCalledWith(GAME_CONFIGS.c001, expect.objectContaining({ yieldEvery: 250 }))
  expect(gameGridProps.current?.gameDefinition).toEqual(expect.objectContaining({ gameMode: 'c001', pieces, seed: 'legacy-seed', version: 1 }))
})
