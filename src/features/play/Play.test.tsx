// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GAME_CONFIGS, type PlacedTetromino } from '@/game/gameConfig'

const gameGridProps = vi.hoisted(() => ({ current: undefined as { gameDefinition?: unknown; pieces: readonly PlacedTetromino[] } | undefined }))

vi.mock('@/lib/db', () => ({ clearGameSelection: vi.fn(), loadClassicGameDefinition: vi.fn() }))
vi.mock('@/game/placementV2', () => ({ generateTetrominoPlacementsV2: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./GameGrid', () => ({
  GameGrid: (props: { gameDefinition?: unknown; pieces: readonly PlacedTetromino[] }) => {
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

function renderPlay(seed: string) {
  return render(<MemoryRouter initialEntries={[`/play?mode=c001&seed=${seed}`]}><Play /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  gameGridProps.current = undefined
})

afterEach(() => {
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

it('uses the seed generator for a legacy save with no board definition', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  renderPlay('legacy-seed')

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(generateTetrominoPlacementsV2).toHaveBeenCalledWith(GAME_CONFIGS.c001, expect.objectContaining({ yieldEvery: 250 }))
  expect(gameGridProps.current?.gameDefinition).toEqual(expect.objectContaining({ gameMode: 'c001', pieces, seed: 'legacy-seed', version: 1 }))
})
