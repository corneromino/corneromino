// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GAME_CONFIGS, type PlacedTetromino } from '@/game/gameConfig'
import { chapters } from './careerChapters'

const gameGridProps = vi.hoisted(() => ({ current: undefined as { exitPath?: string; gameDefinition?: { seed: string }; gameId: string; pieces: readonly PlacedTetromino[] } | undefined }))
const initialCareerLevels = chapters.map((chapter) => chapter.levelsData)

vi.mock('@/lib/db', () => ({ clearGameSelection: vi.fn(), loadClassicGameDefinition: vi.fn() }))
vi.mock('@/game/placementV2', () => ({ generateTetrominoPlacementsV2: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { number?: number }) => key === 'career.level' ? `LEVEL ${values?.number}` : key }) }))
vi.mock('./GameGrid', () => ({
  GameGrid: (props: { exitPath?: string; gameDefinition?: { seed: string }; gameId: string; pieces: readonly PlacedTetromino[] }) => {
    gameGridProps.current = props
    return <output data-testid="game-grid">{props.pieces.length}</output>
  },
}))
vi.mock('./ClassicShapesDialog', () => ({ ClassicShapesDialog: () => null }))

import { loadClassicGameDefinition } from '@/lib/db'
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
  gameGridProps.current = undefined
})

afterEach(() => {
  cleanup()
  for (const [index, chapter] of chapters.entries()) chapter.levelsData = initialCareerLevels[index]!
  vi.restoreAllMocks()
})

it('loads a stored board definition without running the seed generator', async () => {
  const definition = { config: { ...GAME_CONFIGS.c001 }, gameMode: 'c001' as const, pieces, seed: 'saved-board', version: 1 as const }
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(definition)

  renderPlay('saved-board')

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(generateTetrominoPlacementsV2).not.toHaveBeenCalled()
  expect(gameGridProps.current?.gameDefinition).toEqual(definition)
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
  chapters[0]!.levelsData = [{
    config: { ...GAME_CONFIGS.c003 },
    customName: 'Ignored custom title',
    gameMode: 'c003',
    pieces,
    seed: 'authored-career-board',
    source: 'custom',
    version: 1,
  }]

  render(<MemoryRouter initialEntries={['/play?mode=c003&career=the-beginning&level=0']}><Play /></MemoryRouter>)

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(screen.getByText('LEVEL 1')).toBeTruthy()
  expect(gameGridProps.current).toMatchObject({
    exitPath: '/play/levels',
    gameDefinition: { seed: 'career:authored-career-board' },
    gameId: 'career:authored-career-board',
  })
  expect(generateTetrominoPlacementsV2).not.toHaveBeenCalled()
})

it('uses the seed generator for a legacy save with no board definition', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  renderPlay('legacy-seed')

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(generateTetrominoPlacementsV2).toHaveBeenCalledWith(GAME_CONFIGS.c001, expect.objectContaining({ yieldEvery: 250 }))
  expect(gameGridProps.current?.gameDefinition).toEqual(expect.objectContaining({ gameMode: 'c001', pieces, seed: 'legacy-seed', version: 1 }))
})
