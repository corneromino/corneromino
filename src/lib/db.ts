import { openDB } from 'idb'
import { isGameMode, type CellMarker, type GameMode, type GameSelectionState, type LockedCellGroup } from '@/game/gameConfig'
import { isVsTrapResolution, isVsWinCount, VS_LOCAL_CONFIG } from '@/features/vs/vsLocalConfig'
import { getVsAllowedCells, getVsHistoryPosition, getVsPlayerScores, type VsCaptureStreak, type VsGameResult, type VsLocalGameState, type VsLocalPosition, type VsMoveHistory } from '@/features/vs/vsLocalGame'

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

export type VsLocalGameSaveState = VsLocalGameState

type OptionalLegacyVsFields = 'allowHistoryRewrite' | 'allowOverlappingCombinationWin' | 'history' | 'captureStreak' | 'combinationWinCount' | 'consecutiveTurnWinCount' | 'result' | 'nextMoveConstraint' | 'pendingMoveDirection' | 'trapResolution'
type LegacyVsLocalGameSaveState = Omit<VsLocalGameSaveState, OptionalLegacyVsFields>
  & Partial<Pick<VsLocalGameSaveState, OptionalLegacyVsFields>>

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
const VS_LOCAL_STORAGE_KEY = 'vs:local:current'

function isVsPlayer(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1
}

function isVsPlacement(value: unknown): value is { column: number; corner: 0 | 1 | 2 | 3; row: number } {
  return typeof value === 'object'
    && value !== null
    && 'column' in value && typeof value.column === 'number' && Number.isInteger(value.column) && value.column >= 0 && value.column < 10
    && 'row' in value && typeof value.row === 'number' && Number.isInteger(value.row) && value.row >= 0 && value.row < 10
    && 'corner' in value && (value.corner === 0 || value.corner === 1 || value.corner === 2 || value.corner === 3)
}

function isVsMoveDirection(value: unknown): value is 'orthogonal' | 'diagonal' {
  return value === 'orthogonal' || value === 'diagonal'
}

function isVsMoveConstraint(value: unknown): value is { direction: 'orthogonal' | 'diagonal'; originColumn: number; originRow: number } {
  return typeof value === 'object'
    && value !== null
    && 'direction' in value && isVsMoveDirection(value.direction)
    && 'originColumn' in value && typeof value.originColumn === 'number' && Number.isInteger(value.originColumn) && value.originColumn >= 0 && value.originColumn < 10
    && 'originRow' in value && typeof value.originRow === 'number' && Number.isInteger(value.originRow) && value.originRow >= 0 && value.originRow < 10
}

function isVsCaptureStreak(value: unknown): value is VsCaptureStreak {
  return typeof value === 'object'
    && value !== null
    && 'player' in value && isVsPlayer(value.player)
    && 'turnCount' in value && typeof value.turnCount === 'number' && Number.isSafeInteger(value.turnCount) && value.turnCount >= 1
}

function isVsGameResult(value: unknown): value is VsGameResult {
  if (typeof value !== 'object' || value === null || !('reason' in value) || !('winner' in value)) return false
  switch (value.reason) {
    case 'combination':
      return isVsPlayer(value.winner) && 'shapeCount' in value && isVsWinCount(value.shapeCount)
    case 'consecutive-turns':
      return isVsPlayer(value.winner) && 'turnCount' in value && isVsWinCount(value.turnCount)
    case 'trap':
      return value.winner === null || isVsPlayer(value.winner)
    case 'no-legal-moves':
      return value.winner === null
    default:
      return false
  }
}

function isVsLocalPosition(value: unknown): value is Pick<LegacyVsLocalGameSaveState, keyof VsLocalPosition> {
  return typeof value === 'object'
    && value !== null
    && 'activePlayer' in value && isVsPlayer(value.activePlayer)
    && (!('captureStreak' in value) || value.captureStreak === null || isVsCaptureStreak(value.captureStreak))
    && (!('result' in value) || value.result === null || isVsGameResult(value.result))
    && (!('nextMoveConstraint' in value) || value.nextMoveConstraint === null || isVsMoveConstraint(value.nextMoveConstraint))
    && 'placedCornerominoes' in value && Array.isArray(value.placedCornerominoes) && value.placedCornerominoes.every((placement) => (
      isVsPlacement(placement)
      && 'player' in placement && isVsPlayer(placement.player)
      && (!('lockedBy' in placement) || isVsPlayer(placement.lockedBy))
    ))
    && 'lockedCornerominoes' in value && Array.isArray(value.lockedCornerominoes) && value.lockedCornerominoes.every((corneromino) => (
      typeof corneromino === 'object' && corneromino !== null
      && 'id' in corneromino && typeof corneromino.id === 'string'
      && 'player' in corneromino && isVsPlayer(corneromino.player)
      && 'cellKeys' in corneromino && Array.isArray(corneromino.cellKeys) && corneromino.cellKeys.length === 4 && corneromino.cellKeys.every((cellKey: unknown) => typeof cellKey === 'string')
    ))
}

function isVsMoveHistory(value: unknown): value is VsMoveHistory {
  return typeof value === 'object' && value !== null
    && 'positions' in value && Array.isArray(value.positions)
    && value.positions.length > 0 && value.positions.length <= 101
    && 'index' in value && typeof value.index === 'number' && Number.isInteger(value.index)
    && value.index >= 0 && value.index < value.positions.length
    && value.positions.every((position) => isVsLocalPosition(position)
      && 'captureStreak' in position && 'nextMoveConstraint' in position && 'result' in position)
}

function isVsLocalGameSaveState(value: unknown): value is LegacyVsLocalGameSaveState {
  return isVsLocalPosition(value)
    && (!('allowHistoryRewrite' in value) || typeof value.allowHistoryRewrite === 'boolean')
    && (!('allowOverlappingCombinationWin' in value) || typeof value.allowOverlappingCombinationWin === 'boolean')
    && (!('history' in value) || isVsMoveHistory(value.history))
    && (!('combinationWinCount' in value) || isVsWinCount(value.combinationWinCount))
    && (!('consecutiveTurnWinCount' in value) || isVsWinCount(value.consecutiveTurnWinCount))
    && (!('trapResolution' in value) || isVsTrapResolution(value.trapResolution))
    && (!('pendingMoveDirection' in value) || isVsMoveDirection(value.pendingMoveDirection))
    && 'pendingPlacement' in value && (value.pendingPlacement === null || isVsPlacement(value.pendingPlacement))
}

function hasValidVsResult(state: VsLocalGameSaveState): boolean {
  const { result } = state
  if (!result) return state.captureStreak === null || state.captureStreak.turnCount < state.consecutiveTurnWinCount
  if (state.pendingPlacement !== null) return false

  switch (result.reason) {
    case 'combination':
      return result.winner === state.activePlayer && result.shapeCount >= state.combinationWinCount
    case 'consecutive-turns':
      return result.winner === state.activePlayer
        && result.turnCount >= state.consecutiveTurnWinCount
        && state.captureStreak?.player === result.winner
        && state.captureStreak.turnCount === result.turnCount
    case 'trap':
    case 'no-legal-moves': {
      // Ignore the finished-state input guard when verifying actual board mobility.
      if (!state.nextMoveConstraint || getVsAllowedCells({ ...state, result: null }).length > 0) return false
      if (result.reason === 'no-legal-moves') return state.captureStreak?.player !== state.activePlayer
      if (state.captureStreak?.player !== state.activePlayer) return false
      const [first, second] = getVsPlayerScores(state.placedCornerominoes)
      const expectedWinner = state.trapResolution === 'draw' || first === second ? null : first > second ? 0 : 1
      return result.winner === expectedWinner
    }
  }
}

function hasValidVsHistory(state: VsLocalGameSaveState): boolean {
  const { index, positions } = state.history
  if (JSON.stringify(getVsHistoryPosition(state)) !== JSON.stringify(getVsHistoryPosition(positions[index]))) return false
  if (!state.allowHistoryRewrite && index < positions.length - 1 && state.pendingPlacement !== null) return false
  return positions.every((position, positionIndex) => {
    if (position.placedCornerominoes.length > 100) return false
    if (position.result && positionIndex !== positions.length - 1) return false
    if (!hasValidVsResult({ ...state, ...position, pendingPlacement: null })) return false
    if (positionIndex === 0) return true
    const previous = positions[positionIndex - 1]
    if (position.placedCornerominoes.length !== previous.placedCornerominoes.length + 1) return false
    return previous.placedCornerominoes.every((cell, cellIndex) => {
      const next = position.placedCornerominoes[cellIndex]
      return cell.column === next.column && cell.row === next.row && cell.corner === next.corner && cell.player === next.player
        && (cell.lockedBy === undefined || cell.lockedBy === next.lockedBy)
    })
  })
}

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

export async function loadVsLocalGameState(): Promise<VsLocalGameSaveState | null> {
  const storedState = await (await db).get('games', VS_LOCAL_STORAGE_KEY)
  if (!storedState || !isVsLocalGameSaveState(storedState.state)) return null
  const position: VsLocalPosition = {
    activePlayer: storedState.state.activePlayer,
    // Earlier saves cannot reconstruct a capture streak from locked groups alone.
    captureStreak: storedState.state.captureStreak ?? null,
    lockedCornerominoes: storedState.state.lockedCornerominoes,
    nextMoveConstraint: storedState.state.nextMoveConstraint ?? null,
    placedCornerominoes: storedState.state.placedCornerominoes,
    // Older saves have no turn history from which to infer a combination victory.
    result: storedState.state.result ?? null,
  }
  const state: VsLocalGameSaveState = {
    ...storedState.state,
    ...position,
    allowHistoryRewrite: storedState.state.allowHistoryRewrite ?? VS_LOCAL_CONFIG.allowHistoryRewrite,
    // Earlier matches counted overlapping captures; preserve their rules and results.
    allowOverlappingCombinationWin: storedState.state.allowOverlappingCombinationWin ?? true,
    combinationWinCount: storedState.state.combinationWinCount ?? VS_LOCAL_CONFIG.combinationWinCount,
    consecutiveTurnWinCount: storedState.state.consecutiveTurnWinCount ?? VS_LOCAL_CONFIG.consecutiveTurnWinCount,
    // Old saves lack the per-turn direction choices needed to rebuild earlier positions.
    history: storedState.state.history ?? { positions: [position], index: 0 },
    pendingMoveDirection: storedState.state.pendingMoveDirection ?? 'orthogonal',
    trapResolution: storedState.state.trapResolution ?? VS_LOCAL_CONFIG.trapResolution,
  }
  return hasValidVsResult(state) && hasValidVsHistory(state) ? state : null
}

export async function saveVsLocalGameState(state: VsLocalGameSaveState): Promise<void> {
  await (await db).put('games', { id: VS_LOCAL_STORAGE_KEY, state, updatedAt: Date.now() })
}

export async function clearVsLocalGameState(): Promise<void> {
  await (await db).delete('games', VS_LOCAL_STORAGE_KEY)
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
