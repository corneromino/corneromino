// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GAME_CONFIGS, type PlacedTetromino } from '@/game/gameConfig'
import { careerLevels } from './careerLevels'

const gameGridProps = vi.hoisted(() => ({ current: undefined as {
  boardHitTestRef?: { current: ((point: { clientX: number; clientY: number }) => boolean | null) | null }
  exitPath?: string
  config?: { finalVerificationMode?: 'auto' | 'manual' }
  gameDefinition?: { seed: string }
  gameDataForCopy?: { bonus?: readonly { shape: string; count: number }[]; seed: string }
  gameId: string
  boardInteractive?: boolean
  emptyCellBorderOpacity?: number
  emptyCellOpacity?: number
  edgeFadeEnabled?: boolean
  showCornerMarkers?: boolean
  hideGameControls?: boolean
  highlightAreas?: readonly { height: number; id: string; left: number; top: number; width: number }[]
  onLocked?: () => void
  onGameCompleted?: (result: { bonusPercentage: number; perfectionPercentage: number }) => void
  onCorrectVerification?: () => void
  onEntranceAnimationComplete?: () => void
  onRestart?: () => void
  onSelected?: () => void
  pieces: readonly PlacedTetromino[]
  paused?: boolean
  persistSelection?: boolean
  tutorialControlIds?: { reset?: string }
} | undefined }))
vi.hoisted(() => document.documentElement.style.setProperty('--paper', '#ffd18a'))
const tutorialDriverMock = vi.hoisted(() => ({ destroy: vi.fn(), drive: vi.fn(), moveTo: vi.fn() }))
const initialCareerLevels = [...careerLevels]

vi.mock('@/lib/db', () => ({ clearGameSelection: vi.fn(), completeCareerLevel: vi.fn(), loadCareerLevelGeneration: vi.fn(), loadCareerProgression: vi.fn(), loadClassicGameDefinition: vi.fn(), saveCareerLevelGeneration: vi.fn(), saveClassicGameDefinition: vi.fn() }))
vi.mock('@/game/placementV2', () => ({ generateTetrominoPlacementsV2: vi.fn() }))
vi.mock('@/components/tutorial/createTutorialDriver', () => ({ createTutorialDriver: vi.fn(() => tutorialDriverMock) }))
vi.mock('../main-menu/TetrominoBackground', () => ({ TetrominoBackground: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { number?: number }) => key === 'career.level' ? `LEVEL ${values?.number}` : key }) }))
vi.mock('./GameGrid', () => ({
  GameGrid: (props: typeof gameGridProps.current extends infer Props ? NonNullable<Props> : never) => {
    gameGridProps.current = props
    useEffect(() => props.onEntranceAnimationComplete?.(), [props.onEntranceAnimationComplete])
    useEffect(() => {
      if (!props.boardHitTestRef) return
      props.boardHitTestRef.current = ({ clientX }) => clientX >= 100
      return () => { if (props.boardHitTestRef) props.boardHitTestRef.current = null }
    }, [props.boardHitTestRef])
    return <output data-testid="game-grid">{props.pieces.length}</output>
  },
}))
vi.mock('./ClassicShapesDialog', () => ({ ClassicShapesDialog: () => null }))

import { clearGameSelection, loadCareerLevelGeneration, loadCareerProgression, loadClassicGameDefinition, saveCareerLevelGeneration, saveClassicGameDefinition } from '@/lib/db'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT } from './careerInfiniteGeneration'
import { getCareerInfiniteDifficulty } from './careerInfiniteDifficulty'
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
  vi.mocked(loadCareerLevelGeneration).mockResolvedValue({ infiniteRepeats: {} })
  vi.mocked(loadCareerProgression).mockResolvedValue([])
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

it('toggles the HUD without moving or replacing the board, and ignores board and control taps', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue({ config: { ...GAME_CONFIGS.c001 }, gameMode: 'c001', pieces, seed: 'hud-test', version: 1 })
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1 }
  })
  const view = renderPlay('hud-test')
  await screen.findByTestId('game-grid')
  const main = view.container.querySelector('main')!
  const header = main.querySelector('header')!
  const board = screen.getByTestId('game-grid')
  const tap = (target: Element, x: number) => {
    fireEvent.pointerDown(target, { pointerId: 1, clientX: x, clientY: 30, button: 0 })
    fireEvent.pointerUp(target, { pointerId: 1, clientX: x, clientY: 30, button: 0 })
  }
  tap(board, 110)
  expect(header.getAttribute('aria-hidden')).toBeNull()
  const fullscreen = screen.getByRole('button', { name: 'common.fullScreen' })
  tap(fullscreen, 10)
  expect(header.getAttribute('aria-hidden')).toBeNull()
  fireEvent.click(fullscreen)
  expect(header.getAttribute('aria-hidden')).toBe('true')
  expect(header.hasAttribute('inert')).toBe(true)
  expect(gameGridProps.current?.hideGameControls).toBe(true)
  expect(gameGridProps.current?.edgeFadeEnabled).toBe(false)
  expect(screen.getByTestId('game-grid')).toBe(board)
  tap(main, 10)
  expect(header.getAttribute('aria-hidden')).toBeNull()
  expect(gameGridProps.current?.hideGameControls).toBe(false)
  expect(gameGridProps.current?.edgeFadeEnabled).toBe(true)
  tap(main, 10)
  expect(header.getAttribute('aria-hidden')).toBe('true')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(header.getAttribute('aria-hidden')).toBeNull()
  expect(header.hasAttribute('inert')).toBe(false)
})

it('does not activate a button when a reveal tap is retargeted to it', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue({ config: { ...GAME_CONFIGS.c001 }, gameMode: 'c001', pieces, seed: 'hud-touch', version: 1 })
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1 }
  })
  const view = renderPlay('hud-touch')
  await screen.findByTestId('game-grid')
  const main = view.container.querySelector('main')!
  const pause = screen.getByTitle('common.pause')
  fireEvent.click(screen.getByRole('button', { name: 'common.fullScreen' }))
  fireEvent.pointerDown(main, { pointerId: 1, clientX: 10, clientY: 30, button: 0 })
  fireEvent.pointerUp(main, { pointerId: 1, clientX: 10, clientY: 30, button: 0 })
  fireEvent.click(pause, { detail: 1 })
  expect(gameGridProps.current?.paused).toBe(false)
  fireEvent.pointerDown(pause, { pointerId: 1, clientX: 10, clientY: 30, button: 0 })
  fireEvent.pointerUp(pause, { pointerId: 1, clientX: 10, clientY: 30, button: 0 })
  fireEvent.click(pause, { detail: 1 })
  expect(gameGridProps.current?.paused).toBe(true)
})

it('restores the HUD and board fade when verification finds the board correct', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue({ config: { ...GAME_CONFIGS.c001 }, gameMode: 'c001', pieces, seed: 'hud-correct', version: 1 })
  const view = renderPlay('hud-correct')
  await screen.findByTestId('game-grid')
  fireEvent.click(screen.getByRole('button', { name: 'common.fullScreen' }))
  expect(view.container.querySelector('header')?.getAttribute('aria-hidden')).toBe('true')
  expect(gameGridProps.current?.edgeFadeEnabled).toBe(false)
  act(() => gameGridProps.current?.onCorrectVerification?.())
  expect(view.container.querySelector('header')?.getAttribute('aria-hidden')).toBeNull()
  expect(gameGridProps.current?.hideGameControls).toBe(false)
  expect(gameGridProps.current?.edgeFadeEnabled).toBe(true)
})

it('regenerates and persists saved definitions with duplicate bonuses', async () => {
  const definition = {
    bonus: [
      { count: 1, rotation: 0 as const, shape: 'O' as const },
      { count: 1, rotation: 0 as const, shape: 'O' as const },
    ],
    config: { ...GAME_CONFIGS.c001, bonusMax: 2, bonusMin: 2 },
    gameMode: 'c001' as const,
    pieces,
    seed: 'duplicate-bonuses',
    version: 1 as const,
  }
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(definition)

  renderPlay(definition.seed)

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  const regeneratedBonus = (gameGridProps.current?.gameDefinition as { bonus?: readonly { rotation?: number; shape: string }[] } | undefined)?.bonus
  expect(regeneratedBonus).toHaveLength(2)
  expect(new Set(regeneratedBonus?.map((bonus) => `${bonus.shape}:${bonus.rotation ?? 'any'}`)).size).toBe(2)
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
    bonus: [{ shape: 'O', count: 1 }],
    data: {
      config: { ...GAME_CONFIGS.c003 },
      customName: 'Ignored custom title',
      gameMode: 'c003',
      pieces,
      seed: 'authored-career-board',
      source: 'custom',
      version: 1,
    },
    rendering: { emptyCellBorderOpacity: 0.5, emptyCellOpacity: 0.25, showCornerMarkers: false },
    x: 12,
    y: 34,
  })

  render(<MemoryRouter initialEntries={['/play?career=authored-career-board']}><Play /></MemoryRouter>)

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(screen.getByText('LEVEL 1')).toBeTruthy()
  expect(gameGridProps.current).toMatchObject({
    exitPath: '/',
    gameDefinition: { seed: 'career:authored-career-board' },
    gameDataForCopy: { seed: 'career:authored-career-board', bonus: [{ shape: 'O', count: 1 }] },
    gameId: 'career:authored-career-board',
    emptyCellBorderOpacity: 0.5,
    emptyCellOpacity: 0.25,
    showCornerMarkers: false,
  })
  expect(generateTetrominoPlacementsV2).not.toHaveBeenCalled()
})

it('plays the first authored board when a Career level has definition alternatives', async () => {
  const defaultDefinition = {
    config: { ...GAME_CONFIGS.c003 },
    gameMode: 'c003' as const,
    pieces,
    seed: 'default-career-board',
    version: 1 as const,
  }
  const alternativeDefinition = {
    ...defaultDefinition,
    gameMode: 'c001' as const,
    seed: 'alternative-career-board',
  }
  careerLevels.splice(0, careerLevels.length, {
    data: [defaultDefinition, alternativeDefinition],
    x: 12,
    y: 34,
  })

  render(<MemoryRouter initialEntries={['/play?career=default-career-board']}><Play /></MemoryRouter>)

  await waitFor(() => expect(gameGridProps.current?.gameDefinition?.seed).toBe('career:default-career-board'))
  expect(gameGridProps.current?.gameDefinition).toMatchObject({ gameMode: 'c003', pieces })
  expect(generateTetrominoPlacementsV2).not.toHaveBeenCalled()
})

it('switches to a tutorial definition alternative and starts it with a fresh board', async () => {
  const defaultDefinition = {
    config: { ...GAME_CONFIGS.c003 },
    gameMode: 'c003' as const,
    pieces,
    seed: 'tutorial-default-board',
    version: 1 as const,
  }
  const alternativePieces = [{ ...pieces[0]!, id: 2 }]
  const alternativeDefinition = {
    ...defaultDefinition,
    pieces: alternativePieces,
    seed: 'tutorial-alternative-board',
  }
  careerLevels.splice(0, careerLevels.length, {
    data: [defaultDefinition, alternativeDefinition],
    tutorial: {
      steps: [{
        advanceOn: ['select'],
        area: 'board',
        board: { columns: 1, rows: 1 },
        content: 'Select a cell.',
      }, {
        area: 'board',
        board: { columns: 1, rows: 1 },
        content: 'Here is another board.',
        dataIndex: 1,
      }],
    },
    x: 12,
    y: 34,
  })

  render(<MemoryRouter initialEntries={['/play?career=tutorial-default-board']}><Play /></MemoryRouter>)
  await waitFor(() => expect(gameGridProps.current?.pieces[0]?.id).toBe(1))

  act(() => gameGridProps.current?.onSelected?.())

  await waitFor(() => expect(gameGridProps.current?.pieces[0]?.id).toBe(2))
  expect(gameGridProps.current?.gameDefinition?.seed).toBe('career:tutorial-default-board')
})

it('generates and persists a board for a configuration-based Career level', async () => {
  careerLevels.splice(0, careerLevels.length, {
    data: { ...GAME_CONFIGS.c001, tetrominoCount: 1 },
    x: 12,
    y: 34,
  })
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  render(<MemoryRouter initialEntries={['/play?career=level-1']}><Play /></MemoryRouter>)

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(generateTetrominoPlacementsV2).toHaveBeenCalledWith(
    expect.objectContaining({ tetrominoCount: 1 }),
    expect.objectContaining({ random: expect.any(Function) }),
  )
  expect(gameGridProps.current).toMatchObject({
    gameDefinition: {
      config: expect.objectContaining({ tetrominoCount: 1 }),
      gameMode: 'c001',
      seed: 'career:level-1',
    },
    gameId: 'career:level-1',
  })
  expect(saveClassicGameDefinition).toHaveBeenCalledWith(gameGridProps.current?.gameDefinition)
})

it('uses bounded placement for the infinite Career level and persists its starting configuration', async () => {
  const levelNumber = careerLevels.findIndex((level) => level.repeat === 'infinite') + 1
  const id = `level-${levelNumber}`
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  render(<MemoryRouter initialEntries={[`/play?career=${id}`]}><Play /></MemoryRouter>)

  await waitFor(() => expect(gameGridProps.current?.gameDefinition?.seed).toBe(`career:${id}`))
  expect(generateTetrominoPlacementsV2).toHaveBeenCalledWith(
    expect.objectContaining(getCareerInfiniteDifficulty(levelNumber)),
    expect.objectContaining({ maxIterations: CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT, yieldEvery: 250 }),
  )
  expect(saveClassicGameDefinition).toHaveBeenCalledWith(expect.objectContaining({ seed: `career:${id}` }))
})

it('retains an already saved infinite Career board instead of replacing it with a new curve', async () => {
  const id = `level-${careerLevels.findIndex((level) => level.repeat === 'infinite') + 1}`
  const saved = {
    config: { ...GAME_CONFIGS.c001, tetrominoCount: 1 }, gameMode: 'c001' as const,
    pieces, seed: `career:${id}`, version: 1 as const,
  }
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(saved)

  render(<MemoryRouter initialEntries={[`/play?career=${id}`]}><Play /></MemoryRouter>)

  await waitFor(() => expect(gameGridProps.current?.gameDefinition).toEqual(saved))
  expect(generateTetrominoPlacementsV2).not.toHaveBeenCalled()
})

it('gives every repeated configuration level its own persisted board identity', async () => {
  careerLevels.splice(0, careerLevels.length, {
    data: { ...GAME_CONFIGS.c001, tetrominoCount: 1 },
    repeat: 1,
    x: 12,
    y: 34,
  })
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  const firstLevel = render(<MemoryRouter initialEntries={['/play?career=level-1']}><Play /></MemoryRouter>)
  await waitFor(() => expect(gameGridProps.current?.gameDefinition?.seed).toBe('career:level-1'))
  firstLevel.unmount()

  render(<MemoryRouter initialEntries={['/play?career=level-2']}><Play /></MemoryRouter>)
  await waitFor(() => expect(gameGridProps.current?.gameDefinition?.seed).toBe('career:level-2'))

  expect(saveClassicGameDefinition).toHaveBeenNthCalledWith(1, expect.objectContaining({ seed: 'career:level-1' }))
  expect(saveClassicGameDefinition).toHaveBeenNthCalledWith(2, expect.objectContaining({ seed: 'career:level-2' }))
})

it('extends an infinite Career section after completing its current tail level', async () => {
  careerLevels.splice(0, careerLevels.length, {
    data: { ...GAME_CONFIGS.c001, tetrominoCount: 1 },
    repeat: 'infinite',
    x: 12,
    y: 34,
  })
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  render(<MemoryRouter initialEntries={['/play?career=level-1']}><Play /></MemoryRouter>)
  await waitFor(() => expect(gameGridProps.current?.gameDefinition?.seed).toBe('career:level-1'))

  act(() => gameGridProps.current?.onGameCompleted?.({ bonusPercentage: 100, perfectionPercentage: 100 }))

  await waitFor(() => expect(saveCareerLevelGeneration).toHaveBeenCalledWith({ infiniteRepeats: { 0: 2 } }))
})

it('regenerates an unfinished configuration-based Career board on restart', async () => {
  let builderCallCount = 0
  careerLevels.splice(0, careerLevels.length, {
    data: () => {
      builderCallCount += 1
      return { data: { ...GAME_CONFIGS.c001, tetrominoCount: builderCallCount } }
    },
    x: 12,
    y: 34,
  })
  const regeneratedPieces = [{ ...pieces[0]!, id: 2 }]
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2)
    .mockResolvedValueOnce([...pieces])
    .mockResolvedValueOnce(regeneratedPieces)

  render(<MemoryRouter initialEntries={['/play?career=level-1']}><Play /></MemoryRouter>)
  await waitFor(() => expect(gameGridProps.current?.gameDefinition?.seed).toBe('career:level-1'))

  act(() => gameGridProps.current?.onRestart?.())

  await waitFor(() => expect(gameGridProps.current?.pieces[0]?.id).toBe(2))
  expect(generateTetrominoPlacementsV2).toHaveBeenCalledTimes(2)
  expect(generateTetrominoPlacementsV2).toHaveBeenNthCalledWith(1, expect.objectContaining({ tetrominoCount: 1 }), expect.anything())
  expect(generateTetrominoPlacementsV2).toHaveBeenNthCalledWith(2, expect.objectContaining({ tetrominoCount: 2 }), expect.anything())
  expect(builderCallCount).toBe(2)
})

it('reuses a completed configuration-based Career board instead of regenerating it', async () => {
  careerLevels.splice(0, careerLevels.length, {
    data: { ...GAME_CONFIGS.c001, tetrominoCount: 1 },
    x: 12,
    y: 34,
  })
  const completedDefinition = {
    bonus: [],
    config: { ...GAME_CONFIGS.c001, tetrominoCount: 1 },
    gameMode: 'c001' as const,
    pieces,
    seed: 'career:level-1',
    version: 1 as const,
  }
  vi.mocked(loadCareerProgression).mockResolvedValue([{
    bonusPercentage: 0,
    perfectionPercentage: 100,
    seed: 'level-1',
    type: 'career-progression',
  }])
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(completedDefinition)

  render(<MemoryRouter initialEntries={['/play?career=level-1']}><Play /></MemoryRouter>)

  await waitFor(() => expect(gameGridProps.current?.gameDefinition?.seed).toBe('career:level-1'))
  expect(gameGridProps.current?.onRestart).toBeUndefined()
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
      autoVerification: false,
      steps: [{
        advanceOn: ['select'],
        area: 'board',
        boardInteractive: true,
        board: { columns: 2 },
        content: 'Lock this shape.',
        showUI: false,
      }, {
        area: 'reset',
        content: 'Restart the board.',
        showUI: true,
      }],
    },
    x: 0,
    y: 0,
  })

  const view = render(<MemoryRouter initialEntries={['/play?career=tutorial-career-board']}><Play /></MemoryRouter>)

  await waitFor(() => expect(tutorialDriverMock.drive).toHaveBeenCalledWith(0))
  expect(gameGridProps.current).toMatchObject({
    boardInteractive: true,
    config: { finalVerificationMode: 'manual' },
    hideGameControls: true,
    highlightAreas: [{ height: GAME_CONFIGS.c003.rows, id: 'career-tutorial-board-0', left: 0, top: 0, width: 2 }],
    persistSelection: false,
    tutorialControlIds: { reset: 'career-tutorial-reset' },
  })
  expect(clearGameSelection).toHaveBeenCalledWith('c003', 'career:tutorial-career-board')
  expect(view.container.querySelector('header')?.getAttribute('aria-hidden')).toBe('true')
  expect((view.container.querySelector('[title="common.fullScreen"]') as HTMLButtonElement).disabled).toBe(true)

  gameGridProps.current?.onSelected?.()
  await waitFor(() => expect(tutorialDriverMock.moveTo).toHaveBeenCalledWith(1))
  expect(view.container.querySelector('header')?.getAttribute('aria-hidden')).toBeNull()
})

it('uses the seed generator for a legacy save with no board definition', async () => {
  vi.mocked(loadClassicGameDefinition).mockResolvedValue(null)
  vi.mocked(generateTetrominoPlacementsV2).mockResolvedValue([...pieces])

  renderPlay('legacy-seed')

  await waitFor(() => expect(screen.getByTestId('game-grid').textContent).toBe('1'))
  expect(generateTetrominoPlacementsV2).toHaveBeenCalledWith(GAME_CONFIGS.c001, expect.objectContaining({ yieldEvery: 250 }))
  expect(gameGridProps.current?.gameDefinition).toEqual(expect.objectContaining({ gameMode: 'c001', pieces, seed: 'legacy-seed', version: 1 }))
})
