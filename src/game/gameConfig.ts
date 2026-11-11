import type { CellId, TetrominoKind } from './tetrominoes'

/** Switch all Classic difficulties between automatic and button-driven locking. */
export const CLASSIC_LOCKING_MODE: GameConfig['lockingMode'] = 'auto'
/** Automatically check a completed Classic board, or require the Verify button. */
export const CLASSIC_FINAL_VERIFICATION_MODE: NonNullable<GameConfig['finalVerificationMode']> = 'auto'

/** Shared defaults; individual game configurations can override these. */
export const CLASSIC_VERIFICATION_EFFECT: NonNullable<GameConfig['verificationEffect']> = 'flip'
export const VERIFICATION_FLIP_DURATION_MS = 2000
export const VERIFICATION_FLIP_BATCH_SIZE = 5

const COMPLETION_SCREENSHOT_DELAY_MS = 400;

export interface GameConfig {
  /** Removes the shared game control bar; tutorials can then present only the board. */
  hideGameControls?: boolean
  lockingMode: 'manual' | 'auto'
  /** Defaults to manual for older/custom game configurations. */
  finalVerificationMode?: 'manual' | 'auto'
  /** Enables the configured verification animation. Defaults to true. */
  completionAnimationEnabled?: boolean
  verificationEffect?: 'wave' | 'flip'
  /** Total time for ALL flip batches, after the screenshot delay. */
  verificationFlipDurationMs?: number
  /** Number of randomly chosen cells which flip together in each batch. */
  verificationFlipBatchSize?: number
  /** Enables the ordinary lock ripple/shake for the board's final shape. Defaults to false. */
  finalLockAnimationEnabled?: boolean
  /** Immediately rejects a lock whose four cells repeat a corner marker. Defaults to false. */
  unlockRepeatedCornerLocks?: boolean
  /** Wait for the final board animation to settle before capturing the completion screenshot. */
  completionScreenshotDelayMs?: number
  /** Tutorials disable navigation so their cell highlights stay aligned. Defaults to true. */
  navigationEnabled?: boolean
  /** Reserves transparent space above the board for raised selected cells. Defaults to true. */
  topSelectionOverflowEnabled?: boolean
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
    spread: 0,
    tetrominoCount: 3,
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
  /** Authored boards retain their color before any player locks are made. */
  color?: string
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
  unlockCount: number
  savedAt: number | null
  selectedCellKeys: string[]
}
