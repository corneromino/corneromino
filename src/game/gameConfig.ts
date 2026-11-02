import type { CellId, TetrominoKind } from './tetrominoes'

/** Switch all Classic difficulties between automatic and button-driven locking. */
export const CLASSIC_LOCKING_MODE: GameConfig['lockingMode'] = 'auto'
/** Automatically check a completed Classic board, or require the Verify button. */
export const CLASSIC_FINAL_VERIFICATION_MODE: NonNullable<GameConfig['finalVerificationMode']> = 'auto'

const COMPLETION_SCREENSHOT_DELAY_MS = 400;

export interface GameConfig {
  /** Removes the shared game control bar; tutorials can then present only the board. */
  hideGameControls?: boolean
  lockingMode: 'manual' | 'auto'
  /** Defaults to manual for older/custom game configurations. */
  finalVerificationMode?: 'manual' | 'auto'
  /** Enables the correct/incorrect verification wave. Defaults to true. */
  completionAnimationEnabled?: boolean
  /** Enables the ordinary lock ripple/shake for the board's final Corneromino. Defaults to false. */
  finalLockAnimationEnabled?: boolean
  /** Immediately rejects a lock whose four cells repeat a corner marker. Defaults to false. */
  unlockRepeatedCornerLocks?: boolean
  /** Wait for the final board animation to settle before capturing the completion screenshot. */
  completionScreenshotDelayMs?: number
  /** Tutorials disable navigation so their cell highlights stay aligned. Defaults to true. */
  navigationEnabled?: boolean
  columns: number
  rows: number
  /** 0 uses the full board; 1 strongly favors placements around its center. */
  spread: number
  tetrominoCount: number
}

export interface GameModeConfig extends GameConfig {
  /** i18next key for the user-visible difficulty label. */
  title: string
}

/**
 * Permanent Classic mode IDs. Object declaration order defines menu difficulty
 * order; never rename or reuse a key after release.
 */
export const GAME_CONFIGS = {
  c001: {
    columns: 4,
    rows: 6,
    spread: 1,
    tetrominoCount: 5,
    title: 'difficulty.veryEasy',
    lockingMode: CLASSIC_LOCKING_MODE,
    finalVerificationMode: CLASSIC_FINAL_VERIFICATION_MODE,
    completionScreenshotDelayMs: COMPLETION_SCREENSHOT_DELAY_MS,
    finalLockAnimationEnabled: true,
  },
  c002: {
    columns: 8,
    rows: 8,
    spread: 1,
    tetrominoCount: 5,
    title: 'difficulty.easy',
    lockingMode: CLASSIC_LOCKING_MODE,
    finalVerificationMode: CLASSIC_FINAL_VERIFICATION_MODE,
    completionScreenshotDelayMs: COMPLETION_SCREENSHOT_DELAY_MS,
    finalLockAnimationEnabled: true,
  },
  c003: {
    columns: 8,
    rows: 8,
    spread: 0,
    tetrominoCount: 10,
    title: 'difficulty.medium',
    lockingMode: CLASSIC_LOCKING_MODE,
    finalVerificationMode: CLASSIC_FINAL_VERIFICATION_MODE,
    completionScreenshotDelayMs: COMPLETION_SCREENSHOT_DELAY_MS,
    finalLockAnimationEnabled: true,
  },
  c004: {
    columns: 10,
    rows: 15,
    spread: 0.5,
    tetrominoCount: 20,
    title: 'difficulty.hard',
    lockingMode: CLASSIC_LOCKING_MODE,
    finalVerificationMode: CLASSIC_FINAL_VERIFICATION_MODE,
    completionScreenshotDelayMs: COMPLETION_SCREENSHOT_DELAY_MS,
    finalLockAnimationEnabled: true,
  },
  c005: {
    columns: 12,
    rows: 18,
    spread: 0.8,
    tetrominoCount: 35,
    title: 'difficulty.expert',
    lockingMode: CLASSIC_LOCKING_MODE,
    finalVerificationMode: CLASSIC_FINAL_VERIFICATION_MODE,
    completionScreenshotDelayMs: COMPLETION_SCREENSHOT_DELAY_MS,
    finalLockAnimationEnabled: true,
  },
  c006: {
    columns: 20,
    rows: 30,
    spread: 0.8,
    tetrominoCount: 100,
    title: 'difficulty.impossible',
    lockingMode: CLASSIC_LOCKING_MODE,
    finalVerificationMode: CLASSIC_FINAL_VERIFICATION_MODE,
    completionScreenshotDelayMs: COMPLETION_SCREENSHOT_DELAY_MS,
    finalLockAnimationEnabled: true,
  },
} satisfies Record<string, GameModeConfig>

export type ClassicGameMode = keyof typeof GAME_CONFIGS
/** Includes the non-configured Infinite mode, which shares GameGrid persistence. */
export type GameMode = ClassicGameMode | 'infinite'
export const GAME_MODES = Object.keys(GAME_CONFIGS) as ClassicGameMode[]

/** Database-only migration map for saves made with pre-permanent difficulty keys. */
export const LEGACY_GAME_MODE_IDS = {
  '?': 'c001',
  'super-easy': 'c002',
  easy: 'c003',
  medium: 'c004',
  hard: 'c005',
  'super-hard': 'c006',
} as const satisfies Record<string, ClassicGameMode>

/** Keeps migrated saves generating the board layout their old mode key produced. */
const LEGACY_GAME_MODE_SEED_KEYS: Partial<Record<ClassicGameMode, string>> = {
  c001: '?',
  c002: 'super-easy',
  c003: 'easy',
  c004: 'medium',
  c005: 'hard',
  c006: 'super-hard',
}

export function getGameModeSeedKey(gameMode: ClassicGameMode): string {
  return LEGACY_GAME_MODE_SEED_KEYS[gameMode] ?? gameMode
}

export function isGameMode(value: string | null): value is ClassicGameMode {
  return value !== null && value in GAME_CONFIGS
}

export const CELL_CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const
export type CellCorner = (typeof CELL_CORNERS)[number]

export interface PlacedTetrominoCell {
  cellId: CellId
  corner: CellCorner
  x: number
  y: number
}

export interface PlacedTetromino {
  id: number
  kind: TetrominoKind
  cells: readonly PlacedTetrominoCell[]
}

export interface LockedCellGroup {
  cellKeys: string[]
  color: string
  id: string
}

export type CellMarkerColor = 'black' | 'white'

export interface CellMarker {
  cellKey: string
  color: CellMarkerColor
}

export interface GameSelectionState {
  elapsedSeconds: number
  gameGridScreenshot: Blob | null
  isCompleted: boolean
  lockedCellGroups: LockedCellGroup[]
  markers: CellMarker[]
  moveCount: number
  savedAt: number | null
  selectedCellKeys: string[]
}
