import { openDB } from 'idb'
import { isGameMode, type CellMarker, type GameMode, type GameSelectionState, type LockedCellGroup } from '@/game/gameConfig'

export interface StoredGame {
  id: string
  updatedAt: number
  state: unknown
}

export interface SavedGame {
  gameId: string
  gameMode: GameMode
  savedAt: number
  screenshot: Blob
}

export interface SandboxWorldState {
  cornerMarkers: Array<{ cellKey: string; corner: number; isOn?: boolean; sourceKey?: string | null }>
  gridOffsetX: number
  gridOffsetY: number
  zoom: number
}

export interface SavedSandboxWorld {
  id: string
  name: string
  savedAt: number
  screenshot: Blob
  state: SandboxWorldState
}

export interface CascadeGameSaveState {
  destroyedLineCount?: number
  elapsedSinceFall: number
  gameState: {
    activePiece: { column: number; corner: 0 | 1 | 2 | 3; row: number } | null
    nextCornerIndex?: number
    settledPieces: Array<{ column: number; corner: 0 | 1 | 2 | 3; row: number }>
    upcomingCorners?: Array<0 | 1 | 2 | 3>
    cornerBag?: Array<0 | 1 | 2 | 3>
    generatedCornerRun?: { corner: 0 | 1 | 2 | 3; length: number }
  }
  lockedPieces: Array<{ cellKey: string; color: number; groupId: string }>
  /** Backwards compatibility for Cascade saves created before lock groups existed. */
  lockedPieceColors?: Array<{ cellKey: string; color: number }>
  lockedCornerominoCount?: number
  score?: number
  selectedPieceKeys: string[]
}

interface CornerominoDatabase {
  games: {
    key: string
    value: StoredGame
  }
  sandboxWorlds: {
    key: string
    value: SavedSandboxWorld
  }
}

export const db = openDB<CornerominoDatabase>('corneromino', 2, {
  upgrade(database) {
    if (!database.objectStoreNames.contains('games')) {
      database.createObjectStore('games', { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains('sandboxWorlds')) {
      database.createObjectStore('sandboxWorlds', { keyPath: 'id' })
    }
  },
})

function selectionStorageKey(gameMode: GameMode, gameId: string): string {
  return `selection:${gameMode}:${gameId}`
}

const CASCADE_STORAGE_KEY = 'cascade:current'
const CASCADE_BEST_SCORE_STORAGE_KEY = 'cascade:best-score'

function isCascadePiece(value: unknown): value is { column: number; corner: 0 | 1 | 2 | 3; row: number } {
  return typeof value === 'object'
    && value !== null
    && (!('destroyedLineCount' in value) || (typeof value.destroyedLineCount === 'number' && value.destroyedLineCount >= 0))
    && 'column' in value && typeof value.column === 'number'
    && 'row' in value && typeof value.row === 'number'
    && 'corner' in value && typeof value.corner === 'number' && Number.isInteger(value.corner) && value.corner >= 0 && value.corner <= 3
}

function isCascadeGameSaveState(value: unknown): value is CascadeGameSaveState {
  return typeof value === 'object'
    && value !== null
    && 'elapsedSinceFall' in value && typeof value.elapsedSinceFall === 'number' && value.elapsedSinceFall >= 0
    && 'gameState' in value && typeof value.gameState === 'object' && value.gameState !== null
    && 'activePiece' in value.gameState && (value.gameState.activePiece === null || isCascadePiece(value.gameState.activePiece))
    && 'settledPieces' in value.gameState && Array.isArray(value.gameState.settledPieces) && value.gameState.settledPieces.every(isCascadePiece)
    && (!('nextCornerIndex' in value.gameState) || (typeof value.gameState.nextCornerIndex === 'number' && value.gameState.nextCornerIndex >= 0))
    && (!('upcomingCorners' in value.gameState) || (Array.isArray(value.gameState.upcomingCorners) && value.gameState.upcomingCorners.every((corner) => Number.isInteger(corner) && corner >= 0 && corner <= 3)))
    && (!('cornerBag' in value.gameState) || (Array.isArray(value.gameState.cornerBag)
      && value.gameState.cornerBag.length <= 4
      && new Set(value.gameState.cornerBag).size === value.gameState.cornerBag.length
      && value.gameState.cornerBag.every((corner) => Number.isInteger(corner) && corner >= 0 && corner <= 3)))
    && (!('generatedCornerRun' in value.gameState) || (
      typeof value.gameState.generatedCornerRun === 'object' && value.gameState.generatedCornerRun !== null
      && 'corner' in value.gameState.generatedCornerRun && typeof value.gameState.generatedCornerRun.corner === 'number'
      && Number.isInteger(value.gameState.generatedCornerRun.corner) && value.gameState.generatedCornerRun.corner >= 0 && value.gameState.generatedCornerRun.corner <= 3
      && 'length' in value.gameState.generatedCornerRun && typeof value.gameState.generatedCornerRun.length === 'number'
      && Number.isInteger(value.gameState.generatedCornerRun.length) && value.gameState.generatedCornerRun.length >= 1
    ))
    && (!('lockedPieces' in value) || (Array.isArray(value.lockedPieces) && value.lockedPieces.every((piece) => (
      typeof piece === 'object' && piece !== null && 'cellKey' in piece && typeof piece.cellKey === 'string' && 'color' in piece && typeof piece.color === 'number' && 'groupId' in piece && typeof piece.groupId === 'string'
    ))))
    && (!('lockedPieceColors' in value) || (Array.isArray(value.lockedPieceColors) && value.lockedPieceColors.every((piece) => (
      typeof piece === 'object' && piece !== null && 'cellKey' in piece && typeof piece.cellKey === 'string' && 'color' in piece && typeof piece.color === 'number'
    ))))
    && ('lockedPieces' in value || 'lockedPieceColors' in value)
    && (!('lockedCornerominoCount' in value) || (typeof value.lockedCornerominoCount === 'number' && value.lockedCornerominoCount >= 0))
    && (!('score' in value) || (typeof value.score === 'number' && value.score >= 0))
    && 'selectedPieceKeys' in value && Array.isArray(value.selectedPieceKeys) && value.selectedPieceKeys.every((cellKey) => typeof cellKey === 'string')
}

function isLockedCellGroup(value: unknown): value is LockedCellGroup {
  return (
    typeof value === 'object' &&
    value !== null &&
    'cellKeys' in value &&
    Array.isArray(value.cellKeys) &&
    value.cellKeys.every((cellKey) => typeof cellKey === 'string') &&
    'color' in value &&
    typeof value.color === 'string' &&
    'id' in value &&
    typeof value.id === 'string'
  )
}

function isCellMarker(value: unknown): value is CellMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'cellKey' in value &&
    typeof value.cellKey === 'string' &&
    'color' in value &&
    (value.color === 'black' || value.color === 'white')
  )
}

function isGameSelectionState(state: unknown): state is {
  elapsedSeconds?: number
  gameGridScreenshot?: Blob | null
  isCompleted?: boolean
  lockedCellGroups?: LockedCellGroup[]
  markers?: CellMarker[]
  markedCellKeys?: string[]
  moveCount?: number
  savedAt?: number | null
  selectedCellKeys: string[]
} {
  return (
    typeof state === 'object' &&
    state !== null &&
    'selectedCellKeys' in state &&
    Array.isArray(state.selectedCellKeys) &&
    state.selectedCellKeys.every((cellKey) => typeof cellKey === 'string') &&
    (!('elapsedSeconds' in state) || (typeof state.elapsedSeconds === 'number' && state.elapsedSeconds >= 0)) &&
    (!('lockedCellGroups' in state) || (Array.isArray(state.lockedCellGroups) && state.lockedCellGroups.every(isLockedCellGroup))) &&
    (!('markers' in state) || (Array.isArray(state.markers) && state.markers.every(isCellMarker))) &&
    (!('markedCellKeys' in state) || (Array.isArray(state.markedCellKeys) && state.markedCellKeys.every((cellKey) => typeof cellKey === 'string'))) &&
    (!('gameGridScreenshot' in state) || state.gameGridScreenshot === null || state.gameGridScreenshot instanceof Blob) &&
    (!('isCompleted' in state) || typeof state.isCompleted === 'boolean') &&
    (!('moveCount' in state) || (typeof state.moveCount === 'number' && state.moveCount >= 0)) &&
    (!('savedAt' in state) || state.savedAt === null || typeof state.savedAt === 'number')
  )
}

export async function loadGameSelection(gameMode: GameMode, gameId: string): Promise<GameSelectionState> {
  const storedGame = await (await db).get('games', selectionStorageKey(gameMode, gameId))
  if (!storedGame || !isGameSelectionState(storedGame.state)) {
    return { elapsedSeconds: 0, gameGridScreenshot: null, isCompleted: false, lockedCellGroups: [], markers: [], moveCount: 0, savedAt: null, selectedCellKeys: [] }
  }

  return {
    elapsedSeconds: 'elapsedSeconds' in storedGame.state && typeof storedGame.state.elapsedSeconds === 'number' ? storedGame.state.elapsedSeconds : 0,
    gameGridScreenshot: 'gameGridScreenshot' in storedGame.state && storedGame.state.gameGridScreenshot instanceof Blob
      ? storedGame.state.gameGridScreenshot
      : null,
    isCompleted: 'isCompleted' in storedGame.state && typeof storedGame.state.isCompleted === 'boolean' ? storedGame.state.isCompleted : false,
    lockedCellGroups: 'lockedCellGroups' in storedGame.state ? storedGame.state.lockedCellGroups : [],
    markers: 'markers' in storedGame.state && Array.isArray(storedGame.state.markers)
      ? storedGame.state.markers
      : 'markedCellKeys' in storedGame.state && Array.isArray(storedGame.state.markedCellKeys)
        ? storedGame.state.markedCellKeys.map((cellKey: string) => ({ cellKey, color: 'black' as const }))
        : [],
    moveCount: 'moveCount' in storedGame.state && typeof storedGame.state.moveCount === 'number' ? storedGame.state.moveCount : 0,
    savedAt: 'savedAt' in storedGame.state && typeof storedGame.state.savedAt === 'number' ? storedGame.state.savedAt : null,
    selectedCellKeys: storedGame.state.selectedCellKeys,
  }
}

export async function loadSavedGames(): Promise<SavedGame[]> {
  const storedGames = await (await db).getAll('games')

  return storedGames.flatMap((storedGame) => {
    if (!isGameSelectionState(storedGame.state) || !storedGame.state.gameGridScreenshot || !storedGame.state.savedAt) {
      return []
    }

    const [prefix, gameMode, ...gameIdParts] = storedGame.id.split(':')
    if (prefix !== 'selection' || !isGameMode(gameMode) || gameIdParts.length === 0) {
      return []
    }

    return [{
      gameId: gameIdParts.join(':'),
      gameMode,
      savedAt: storedGame.state.savedAt,
      screenshot: storedGame.state.gameGridScreenshot,
    }]
  }).sort((firstGame, secondGame) => secondGame.savedAt - firstGame.savedAt)
}

export async function saveGameSelection(gameMode: GameMode, gameId: string, selection: GameSelectionState): Promise<void> {
  await (await db).put('games', {
    id: selectionStorageKey(gameMode, gameId),
    updatedAt: Date.now(),
    state: selection,
  })
}

export async function clearGameSelection(gameMode: GameMode, gameId: string): Promise<void> {
  await (await db).delete('games', selectionStorageKey(gameMode, gameId))
}

export async function deleteSavedGame(gameMode: GameMode, gameId: string): Promise<void> {
  await clearGameSelection(gameMode, gameId)
}

export async function loadCascadeGameState(): Promise<CascadeGameSaveState | null> {
  const storedState = await (await db).get('games', CASCADE_STORAGE_KEY)
  return storedState && isCascadeGameSaveState(storedState.state) ? storedState.state : null
}

export async function saveCascadeGameState(state: CascadeGameSaveState): Promise<void> {
  await (await db).put('games', { id: CASCADE_STORAGE_KEY, state, updatedAt: Date.now() })
}

export async function clearCascadeGameState(): Promise<void> {
  await (await db).delete('games', CASCADE_STORAGE_KEY)
}

export async function loadCascadeBestScore(): Promise<number> {
  const storedScore = await (await db).get('games', CASCADE_BEST_SCORE_STORAGE_KEY)
  return storedScore && typeof storedScore.state === 'number' && storedScore.state >= 0 ? storedScore.state : 0
}

/** Returns the recorded best score, preserving a higher score from another session. */
export async function recordCascadeBestScore(score: number): Promise<number> {
  const currentBestScore = await loadCascadeBestScore()
  if (score <= currentBestScore) return currentBestScore
  await (await db).put('games', { id: CASCADE_BEST_SCORE_STORAGE_KEY, state: score, updatedAt: Date.now() })
  return score
}

export async function saveSandboxWorld(world: SavedSandboxWorld): Promise<void> {
  await (await db).put('sandboxWorlds', world)
}

export async function loadSandboxWorlds(): Promise<SavedSandboxWorld[]> {
  const worlds = await (await db).getAll('sandboxWorlds')
  return worlds.sort((firstWorld, secondWorld) => secondWorld.savedAt - firstWorld.savedAt)
}

export async function loadSandboxWorld(worldId: string): Promise<SavedSandboxWorld | null> {
  return (await (await db).get('sandboxWorlds', worldId)) ?? null
}

export async function deleteSandboxWorld(worldId: string): Promise<void> {
  await (await db).delete('sandboxWorlds', worldId)
}
