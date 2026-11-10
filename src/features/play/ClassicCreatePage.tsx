import { Eraser, Pause, RotateCcw, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEPTH_BUTTON_COLORS, DepthButton, DepthSurface, PAPER_DEPTH_SHADOW_COLOR } from '@/components/ui/depth-surface'
import { createRandomSeed, createSeededRandom } from '@/game/random'
import { CELL_CORNERS, GAME_CONFIGS, isGameMode, type CellCorner, type CellMarkerColor, type ClassicGameMode, type GameConfig, type GameSelectionState, type LockedCellGroup, type PlacedTetromino } from '@/game/gameConfig'
import { getTetrominoKind, TETROMINOES } from '@/game/tetrominoes'
import { chooseLockColor, type ColoredCellGroup } from '@/game/lockingColor'
import { loadClassicGameDefinition, saveClassicGameDefinition, saveGameSelection, type ClassicGameDefinition } from '@/lib/db'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { ClassicCreatePauseDialog } from './ClassicCreatePauseDialog'
import { ClassicCreateSettingsDialog } from './ClassicCreateSettingsDialog'
import { GameGridCanvas, type GameGridCanvasHandle } from './GameGridCanvas'

export const CLASSIC_CREATE_CONFIG: GameConfig = {
  columns: 5,
  hideGameControls: true,
  lockingMode: 'manual',
  navigationEnabled: true,
  rows: 5,
  spread: 0,
  tetrominoCount: 0,
}

const EMPTY_PIECES: readonly PlacedTetromino[] = []
const EMPTY_LOCKED_CELL_GROUPS: readonly LockedCellGroup[] = []
const EMPTY_MARKERS = new Map<string, CellMarkerColor>()
const EMPTY_SELECTED_CELL_KEYS = new Set<string>()
export const CLASSIC_CREATE_DRAFT_STORAGE_KEY = 'corneromino:classic-create-draft'
const DEFAULT_DIMENSIONS = { columns: CLASSIC_CREATE_CONFIG.columns, rows: CLASSIC_CREATE_CONFIG.rows }
const NEXT_CORNER: Readonly<Record<CellCorner, CellCorner>> = {
  'top-right': 'bottom-right',
  'bottom-right': 'bottom-left',
  'bottom-left': 'top-left',
  'top-left': 'top-right',
}

type ClassicGameData = Pick<ClassicGameDefinition, 'config' | 'gameMode' | 'pieces' | 'version'>

function createCustomGameDefinition(data: ClassicGameData, seed: string, customName: string): ClassicGameDefinition {
  return { ...data, customName, seed, source: 'custom' }
}

function parseCellKey(key: string) {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

function createAuthoredPiece(cellKeys: readonly string[], pieces: readonly PlacedTetromino[]): PlacedTetromino | null {
  const positions = cellKeys.map(parseCellKey)
  const kind = getTetrominoKind(positions)
  if (!kind) return null
  const minX = Math.min(...positions.map((cell) => cell.x))
  const minY = Math.min(...positions.map((cell) => cell.y))
  const positionKeys = new Set(positions.map((cell) => `${cell.x - minX},${cell.y - minY}`))
  const rotation = TETROMINOES[kind].rotations.find(({ cells }) => cells.every((cell) => positionKeys.has(`${cell.x},${cell.y}`)))
  if (!rotation) return null

  const corners = [...CELL_CORNERS]
  for (let index = corners.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const corner = corners[index]!
    corners[index] = corners[swapIndex]!
    corners[swapIndex] = corner
  }
  return {
    cells: rotation.cells.map(({ id: cellId, x, y }, index) => ({ cellId, corner: corners[index]!, x: minX + x, y: minY + y })),
    color: chooseLockColor(cellKeys, pieces.flatMap((piece) => piece.color ? [{ cellKeys: piece.cells.map((cell) => `${cell.x},${cell.y}`), color: piece.color }] : [])),
    id: Math.max(0, ...pieces.map((piece) => piece.id)) + 1,
    kind,
  }
}

function isDraftPiece(value: unknown, dimensions: { columns: number; rows: number }): value is PlacedTetromino {
  if (typeof value !== 'object' || value === null) return false
  const piece = value as Record<string, unknown>
  if (typeof piece.id !== 'number' || !Number.isSafeInteger(piece.id) || piece.id < 1 || typeof piece.kind !== 'string' || typeof piece.color !== 'string' || !Array.isArray(piece.cells) || piece.cells.length !== 4) return false
  const cellIds = new Set<string>()
  const positions: Array<{ x: number; y: number }> = []
  for (const cell of piece.cells) {
    if (typeof cell !== 'object' || cell === null) return false
    const storedCell = cell as Record<string, unknown>
    if ((storedCell.cellId !== 'a' && storedCell.cellId !== 'b' && storedCell.cellId !== 'c' && storedCell.cellId !== 'd') || cellIds.has(storedCell.cellId)
      || typeof storedCell.corner !== 'string' || !CELL_CORNERS.includes(storedCell.corner as CellCorner)
      || typeof storedCell.x !== 'number' || !Number.isSafeInteger(storedCell.x) || storedCell.x < 0 || storedCell.x >= dimensions.columns
      || typeof storedCell.y !== 'number' || !Number.isSafeInteger(storedCell.y) || storedCell.y < 0 || storedCell.y >= dimensions.rows) return false
    cellIds.add(storedCell.cellId)
    positions.push({ x: storedCell.x, y: storedCell.y })
  }
  return getTetrominoKind(positions) === piece.kind
}

function loadDraft() {
  if (typeof sessionStorage === 'undefined') return { dimensions: DEFAULT_DIMENSIONS, gameId: null, gameMode: 'c003' as const, name: '', originalName: '', pieces: EMPTY_PIECES, savedConfig: GAME_CONFIGS.c003 }
  try {
    const stored = JSON.parse(sessionStorage.getItem(CLASSIC_CREATE_DRAFT_STORAGE_KEY) ?? 'null') as { dimensions?: unknown; gameId?: unknown; gameMode?: unknown; name?: unknown; originalName?: unknown; pieces?: unknown; savedConfig?: unknown } | null
    if (!stored) throw new Error('Missing draft.')
    const dimensions = stored?.dimensions
    if (typeof dimensions !== 'object' || dimensions === null) throw new Error('Missing draft dimensions.')
    const { columns, rows } = dimensions as Record<string, unknown>
    if (typeof columns !== 'number' || !Number.isSafeInteger(columns) || columns < 1 || typeof rows !== 'number' || !Number.isSafeInteger(rows) || rows < 1 || !Array.isArray(stored.pieces)) throw new Error('Invalid draft dimensions.')
    const draftDimensions = { columns, rows }
    if (!stored.pieces.every((piece) => isDraftPiece(piece, draftDimensions))) throw new Error('Invalid draft pieces.')
    const storedGameMode = typeof stored.gameMode === 'string' ? stored.gameMode : null
    const gameMode = isGameMode(storedGameMode) ? storedGameMode : 'c003'
    const savedConfig = typeof stored.savedConfig === 'object' && stored.savedConfig !== null ? stored.savedConfig as GameConfig : GAME_CONFIGS[gameMode]
    return {
      dimensions: draftDimensions,
      gameId: typeof stored.gameId === 'string' && stored.gameId.length > 0 ? stored.gameId : null,
      gameMode,
      name: typeof stored.name === 'string' ? stored.name : '',
      originalName: typeof stored.originalName === 'string' ? stored.originalName : typeof stored.name === 'string' ? stored.name : '',
      pieces: stored.pieces,
      savedConfig,
    }
  } catch {
    return { dimensions: DEFAULT_DIMENSIONS, gameId: null, gameMode: 'c003' as const, name: '', originalName: '', pieces: EMPTY_PIECES, savedConfig: GAME_CONFIGS.c003 }
  }
}

function colorAuthoredPieces(pieces: readonly PlacedTetromino[]): readonly PlacedTetromino[] {
  const coloredGroups: ColoredCellGroup[] = []
  return pieces.map((piece) => {
    const color = chooseLockColor(piece.cells.map((cell) => `${cell.x},${cell.y}`), coloredGroups)
    coloredGroups.push({ cellKeys: piece.cells.map((cell) => `${cell.x},${cell.y}`), color })
    return { ...piece, color }
  })
}

interface EditGameState {
  gameId: string
  gameMode: ClassicGameMode
  isCustom: boolean
  name: string | null
}

function getEditGameState(state: unknown): EditGameState | null {
  if (typeof state !== 'object' || state === null || !('editGame' in state) || typeof state.editGame !== 'object' || state.editGame === null) return null
  const editGame = state.editGame as Record<string, unknown>
  const gameMode = typeof editGame.gameMode === 'string' ? editGame.gameMode : null
  if (typeof editGame.gameId !== 'string' || !isGameMode(gameMode) || typeof editGame.isCustom !== 'boolean' || (typeof editGame.name !== 'string' && editGame.name !== null)) return null
  return { gameId: editGame.gameId, gameMode, isCustom: editGame.isCustom, name: editGame.name }
}

/** Visual foundation for creating a custom Classic board. Placement tools come later. */
export function ClassicCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const gameCanvasRef = useRef<GameGridCanvasHandle>(null)
  const initialDraftRef = useRef<ReturnType<typeof loadDraft> | null>(null)
  if (initialDraftRef.current === null) initialDraftRef.current = loadDraft()
  const initialDraft = initialDraftRef.current
  const [unsavedGameId, setUnsavedGameId] = useState(() => `custom-${createRandomSeed()}`)
  const [dimensions, setDimensions] = useState(initialDraft.dimensions)
  const [draftDimensions, setDraftDimensions] = useState(() => ({ columns: String(initialDraft.dimensions.columns), rows: String(initialDraft.dimensions.rows) }))
  const [dimensionsOpen, setDimensionsOpen] = useState(false)
  const [dimensionError, setDimensionError] = useState('')
  const [pauseOpen, setPauseOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [placementMode, setPlacementMode] = useState(false)
  const [eraseMode, setEraseMode] = useState(false)
  const [pieces, setPieces] = useState<readonly PlacedTetromino[]>(initialDraft.pieces)
  const [temporaryCellKeys, setTemporaryCellKeys] = useState<readonly string[]>([])
  const [savedGameId, setSavedGameId] = useState<string | null>(initialDraft.gameId)
  const [gameMode, setGameMode] = useState<ClassicGameMode>(initialDraft.gameMode)
  const [savedConfig, setSavedConfig] = useState<GameConfig>(initialDraft.savedConfig)
  const [originalName, setOriginalName] = useState(initialDraft.originalName)
  const [boardName, setBoardName] = useState(initialDraft.name)
  const config = useMemo(() => ({ ...CLASSIC_CREATE_CONFIG, ...dimensions }), [dimensions])
  const repetitionCount = useMemo(() => pieces.filter((piece) => new Set(piece.cells.map((cell) => cell.corner)).size !== CELL_CORNERS.length).length, [pieces])
  const gameDefinitionData = useMemo<ClassicGameData>(() => {
    // Presets include an i18n-only title, but authored definitions use the
    // narrower GameConfig schema so their JSON can be pasted directly in code.
    const { title: _title, ...savedGameConfig } = savedConfig as GameConfig & { title?: unknown }
    return {
      config: {
        ...savedGameConfig,
        columns: config.columns,
        hideGameControls: false,
        navigationEnabled: true,
        rows: config.rows,
        tetrominoCount: pieces.length,
      },
      gameMode,
      pieces: pieces.map(({ color: _color, ...piece }) => piece),
      version: 1,
    }
  }, [config.columns, config.rows, gameMode, pieces, savedConfig])
  const exportedName = boardName.trim()
  const exportedGameId = savedGameId && exportedName === originalName ? savedGameId : unsavedGameId
  const exportedDefinition = useMemo(() => createCustomGameDefinition(gameDefinitionData, exportedGameId, exportedName), [exportedGameId, exportedName, gameDefinitionData])
  const gameDataJson = useMemo(() => JSON.stringify(exportedDefinition, null, 2), [exportedDefinition])

  useEffect(() => {
    sessionStorage.setItem(CLASSIC_CREATE_DRAFT_STORAGE_KEY, JSON.stringify({ dimensions, gameId: savedGameId, gameMode, name: boardName, originalName, pieces, savedConfig }))
  }, [boardName, dimensions, gameMode, originalName, pieces, savedConfig, savedGameId])

  useEffect(() => {
    const editGame = getEditGameState(location.state)
    if (!editGame) return
    let active = true
    void loadClassicGameDefinition(editGame.gameMode, editGame.gameId)
      .then(async (definition) => definition ?? {
        config: { ...GAME_CONFIGS[editGame.gameMode] },
        gameMode: editGame.gameMode,
        pieces: await generateTetrominoPlacementsV2(GAME_CONFIGS[editGame.gameMode], { random: createSeededRandom(`${editGame.gameMode}:${editGame.gameId}`), yieldEvery: 250 }),
        seed: editGame.gameId,
        version: 1,
      } satisfies ClassicGameDefinition)
      .then((definition) => {
        if (!active) return
        setDimensions({ columns: definition.config.columns, rows: definition.config.rows })
        setPieces(colorAuthoredPieces(definition.pieces))
        setTemporaryCellKeys([])
        setGameMode(definition.gameMode)
        setSavedConfig(definition.config)
        setSavedGameId(editGame.isCustom ? editGame.gameId : null)
        const name = editGame.isCustom ? definition.customName ?? editGame.name ?? '' : ''
        setBoardName(name)
        setOriginalName(name)
        navigate('/play/create', { replace: true })
      })
    return () => { active = false }
  }, [location.state, navigate])

  function openDimensionsDialog() {
    setDraftDimensions({ columns: String(dimensions.columns), rows: String(dimensions.rows) })
    setDimensionError('')
    setDimensionsOpen(true)
  }

  function handleDimensionsOpenChange(open: boolean) {
    setDimensionsOpen(open)
    if (!open) setDimensionError('')
  }

  function applyDimensions() {
    const columns = Number(draftDimensions.columns)
    const rows = Number(draftDimensions.rows)
    if (!Number.isSafeInteger(columns) || columns < 1 || !Number.isSafeInteger(rows) || rows < 1) {
      setDimensionError(t('classic.invalidBoardSize'))
      return
    }
    const nextDimensions = { columns, rows }
    const isWithinBoard = ({ x, y }: { x: number; y: number }) => x >= 0 && x < columns && y >= 0 && y < rows
    setPieces((current) => current.filter((piece) => piece.cells.every(isWithinBoard)))
    setTemporaryCellKeys((current) => current.filter((cellKey) => isWithinBoard(parseCellKey(cellKey))))
    setDimensions(nextDimensions)
    setDimensionsOpen(false)
  }

  function quitWithoutSaving() {
    navigate('/play/modes', { replace: true })
  }

  function handleCellToggle(cellKey: string) {
    if (eraseMode) {
      setPieces((current) => current.filter((piece) => !piece.cells.some((cell) => `${cell.x},${cell.y}` === cellKey)))
      return
    }
    if (!placementMode) return
    if (temporaryCellKeys.includes(cellKey)) {
      setTemporaryCellKeys((current) => current.filter((key) => key !== cellKey))
      return
    }
    const piece = pieces.find((candidate) => candidate.cells.some((cell) => `${cell.x},${cell.y}` === cellKey))
    if (piece) {
      setPieces((current) => current.map((candidate) => candidate.id !== piece.id ? candidate : {
        ...candidate,
        cells: candidate.cells.map((cell) => `${cell.x},${cell.y}` === cellKey ? { ...cell, corner: NEXT_CORNER[cell.corner] } : cell),
      }))
      return
    }
    if (temporaryCellKeys.length === 4) return
    const nextTemporaryCells = [...temporaryCellKeys, cellKey]
    if (nextTemporaryCells.length < 4) {
      setTemporaryCellKeys(nextTemporaryCells)
      return
    }
    const authoredPiece = createAuthoredPiece(nextTemporaryCells, pieces)
    if (!authoredPiece) {
      setTemporaryCellKeys(nextTemporaryCells)
      return
    }
    setPieces((current) => [...current, authoredPiece])
    setTemporaryCellKeys([])
  }

  function togglePlacementMode() {
    if (placementMode) setTemporaryCellKeys([])
    if (!placementMode) setEraseMode(false)
    setPlacementMode(!placementMode)
  }

  function toggleEraseMode() {
    if (!eraseMode) {
      setPlacementMode(false)
      setTemporaryCellKeys([])
    }
    setEraseMode(!eraseMode)
  }

  function resetBoard() {
    // A reset starts a distinct authored board, even when editing a prior save.
    setUnsavedGameId(`custom-${createRandomSeed()}`)
    setSavedGameId(null)
    setPieces([])
    setTemporaryCellKeys([])
  }

  async function saveAndQuit() {
    const name = boardName.trim()
    if (!name) {
      setSaveError(t('classic.nameRequired'))
      return
    }
    setIsSaving(true)
    setSaveError('')
    try {
      const gameId = savedGameId && name === originalName ? savedGameId : unsavedGameId
      const screenshot = await new Promise<Blob | null>((resolve) => {
        const canvas = gameCanvasRef.current?.captureBoard({ gameplayPreview: true })
        if (!canvas) {
          resolve(null)
          return
        }
        canvas.toBlob(resolve, 'image/png')
      })
      if (!screenshot) throw new Error('Could not capture the custom board screenshot.')
      const definition = createCustomGameDefinition(
        // A custom board changes its dimensions and contents, not the shared
        // Classic visual/verification behavior players expect in a game.
        gameDefinitionData, gameId, name,
      )
      const selection: GameSelectionState = {
        elapsedSeconds: 0,
        gameGridScreenshot: screenshot,
        isCompleted: false,
        lockedCellGroups: [],
        markers: [],
        moveCount: 0,
        unlockCount: 0,
        savedAt: Date.now(),
        selectedCellKeys: [],
      }
      await saveClassicGameDefinition(definition)
      await saveGameSelection(gameMode, gameId, selection)
      sessionStorage.setItem(CLASSIC_CREATE_DRAFT_STORAGE_KEY, JSON.stringify({ dimensions, gameId, gameMode, name, originalName: name, pieces, savedConfig }))
      setSavedGameId(gameId)
      setBoardName(name)
      setOriginalName(name)
      navigate('/play/modes', { replace: true })
    } catch {
      setSaveError(t('classic.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] items-center justify-between gap-4 px-5 pb-6">
        <div>
          <h1 className="poster-title text-[33px] leading-none">{t('classic.title')}</h1>
          <p className="poster-kicker mt-2 text-[11px] text-[var(--muted-text-color)]">{t('classic.create')}</p>
        </div>
        <DepthButton aria-label={`${t('common.pause')} ${t('classic.title')}`} className="size-10 shrink-0 text-[var(--canvas-foreground)]" onClick={() => setPauseOpen(true)} shadowColor={PAPER_DEPTH_SHADOW_COLOR} title={t('common.pause')}>
          <Pause aria-hidden="true" />
        </DepthButton>
      </header>
      <div className="relative z-10 min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col px-1">
          <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
            <section aria-label={t('classic.createBoard')} className="relative mx-auto max-w-[550px]" style={{ aspectRatio: `${config.columns} / ${config.rows}`, width: `min(100%, calc(100cqh * ${config.columns} / ${config.rows}))` }}>
              <div className="relative size-full">
                <GameGridCanvas
                  config={config}
                  interactive
                  lockedCellGroups={EMPTY_LOCKED_CELL_GROUPS}
                  markers={EMPTY_MARKERS}
                  onToggle={handleCellToggle}
                  pieces={pieces}
                  selectedCellKeys={EMPTY_SELECTED_CELL_KEYS}
                  selectedLockedGroupId={null}
                  showAuthoredPieceColors
                  showCellIds={false}
                  temporaryCellKeys={temporaryCellKeys}
                  ref={gameCanvasRef}
                />
              </div>
            </section>
          </div>
          <div className="mx-auto mt-4 flex shrink-0 gap-2">
            <DepthSurface
              aria-label={t('classic.mistakes', { count: repetitionCount })}
              aria-live="polite"
              className="h-10 min-w-10 px-3 text-[15px] font-black text-[var(--canvas-foreground)]"
              shadowColor={PAPER_DEPTH_SHADOW_COLOR}
            >
              {repetitionCount}
            </DepthSurface>
            <DepthButton
              {...(placementMode ? DEPTH_BUTTON_COLORS.blue : {})}
              aria-label={t('classic.placeCells')}
              aria-pressed={placementMode}
              className="size-10 text-[var(--canvas-foreground)]"
              onClick={togglePlacementMode}
              shadowColor={placementMode ? undefined : PAPER_DEPTH_SHADOW_COLOR}
              title={t('classic.placeCells')}
            >
              <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><rect height="16" rx="2" width="16" x="4" y="4" /><rect fill="currentColor" height="6" rx="1" stroke="none" width="6" x="12" y="6" /></svg>
            </DepthButton>
            <DepthButton
              {...(eraseMode ? DEPTH_BUTTON_COLORS.red : {})}
              aria-label={t('classic.erasePiece')}
              aria-pressed={eraseMode}
              className="size-10 text-[var(--canvas-foreground)]"
              onClick={toggleEraseMode}
              shadowColor={eraseMode ? undefined : PAPER_DEPTH_SHADOW_COLOR}
              title={t('classic.erasePiece')}
            >
              <Eraser aria-hidden="true" />
            </DepthButton>
            <DepthButton {...DEPTH_BUTTON_COLORS.red} aria-label={t('classic.resetBoard')} className="size-10 text-[var(--canvas-foreground)]" onClick={resetBoard} title={t('classic.resetBoard')}>
              <RotateCcw aria-hidden="true" />
            </DepthButton>
            <DepthButton aria-label={t('classic.configureBoardSize')} className="size-10 text-[var(--canvas-foreground)]" onClick={openDimensionsDialog} shadowColor={PAPER_DEPTH_SHADOW_COLOR} title={t('classic.configureBoardSize')}>
              <Settings aria-hidden="true" />
            </DepthButton>
          </div>
        </div>
      </div>
      <ClassicCreateSettingsDialog
        dimensions={draftDimensions}
        error={dimensionError}
        onApply={applyDimensions}
        onDimensionsChange={(nextDimensions) => {
          setDraftDimensions(nextDimensions)
          setDimensionError('')
        }}
        onOpenChange={handleDimensionsOpenChange}
        open={dimensionsOpen}
      />
      <ClassicCreatePauseDialog
        boardName={boardName}
        gameDataJson={gameDataJson}
        isSaving={isSaving}
        onBoardNameChange={(name) => {
          setBoardName(name)
          setSaveError('')
        }}
        onOpenChange={setPauseOpen}
        onQuitWithoutSaving={quitWithoutSaving}
        onSaveAndQuit={saveAndQuit}
        open={pauseOpen}
        saveError={saveError}
      />
    </main>
  )
}
