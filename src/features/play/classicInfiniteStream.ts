import type { GameConfig, PlacedTetromino } from '@/game/gameConfig'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { createSeededRandom } from '@/game/random'

export interface ClassicInfiniteConfig extends GameConfig {
  /** Rows visible at once; each recycled section must be at least this tall. */
  visibleRows: number
  scrollRowsPerSecond: number
}

export const CLASSIC_INFINITE_CONFIG: ClassicInfiniteConfig = {
  columns: 8,
  rows: 20,
  tetrominoCount: 5,
  spread: 0,
  lockingMode: 'auto',
  finalVerificationMode: 'auto',
  navigationEnabled: false,
  topSelectionOverflowEnabled: false,
  visibleRows: 12,
  scrollRowsPerSecond: 1,
}

export interface InfiniteDifficultyCycle {
  apply: (oldConfig: Readonly<ClassicInfiniteConfig>, newConfig: ClassicInfiniteConfig, totalCycle: number) => boolean
  applyEvery: number
  name: string
}

export const INFINITE_TETROMINO_PROGRESSION = {
  incrementBy: 1,
  incrementsPerStage: 5,
  incrementIntervalStep: 1,
  initialIncrementEvery: 1,
  maxTetrominoCount: 30,
  plateauCycles: 20,
} as const

/** Whether the current total difficulty cycle is an increase within its growth stage. */
export function shouldIncreaseInfiniteTetrominoCount(
  totalCycle: number,
  progression = INFINITE_TETROMINO_PROGRESSION,
) {
  let stageStartCycle = 0
  let incrementEvery = progression.initialIncrementEvery

  while (true) {
    const growthCycleCount = progression.incrementsPerStage * incrementEvery
    if (totalCycle < stageStartCycle + growthCycleCount) {
      return (totalCycle - stageStartCycle) % incrementEvery === 0
    }

    const nextStageStartCycle = stageStartCycle + growthCycleCount + progression.plateauCycles
    if (totalCycle < nextStageStartCycle) return false

    stageStartCycle = nextStageStartCycle
    incrementEvery += progression.incrementIntervalStep
  }
}

/** Ordered, repeating difficulty adjustments for valid Infinite locks. */
export const INFINITE_DIFFICULTY_CYCLES: readonly InfiniteDifficultyCycle[] = [
  {
    applyEvery: 5,
    name: 'tetrominoCount',
    apply: (oldConfig, newConfig, totalCycle) => {
      if (oldConfig.tetrominoCount >= INFINITE_TETROMINO_PROGRESSION.maxTetrominoCount) return false
      if (!shouldIncreaseInfiniteTetrominoCount(totalCycle)) return true

      newConfig.tetrominoCount = Math.min(
        INFINITE_TETROMINO_PROGRESSION.maxTetrominoCount,
        oldConfig.tetrominoCount + INFINITE_TETROMINO_PROGRESSION.incrementBy,
      )
      return true
    },
  },
  // {
  //   applyEvery: 5,
  //   name: 'spread',
  //   apply: (_oldConfig, newConfig) => {
  //     newConfig.spread += 0.05
  //     return newConfig.spread <= 1
  //   },
  // },
]

export interface InfiniteDifficultyState {
  config: ClassicInfiniteConfig
  cycleIndex: number
  /** Number of successfully applied cycles since the session began. */
  totalCycle: number
  validLockCountAtLastCycleCheck: number
}

export function createInfiniteDifficultyState(config: ClassicInfiniteConfig): InfiniteDifficultyState {
  return {
    config: { ...config },
    cycleIndex: 0,
    totalCycle: 0,
    validLockCountAtLastCycleCheck: 0,
  }
}

/**
 * Checks the active cycle at its configured lock interval. A cycle's copied
 * configuration is adopted only when its apply callback returns true.
 */
export function advanceInfiniteDifficulty(
  state: InfiniteDifficultyState,
  validLockedCantominoCount: number,
  cycles: readonly InfiniteDifficultyCycle[] = INFINITE_DIFFICULTY_CYCLES,
): InfiniteDifficultyState {
  if (cycles.length === 0) return state

  const cycle = cycles[state.cycleIndex]
  if (!cycle || validLockedCantominoCount - state.validLockCountAtLastCycleCheck !== cycle.applyEvery) return state

  const nextConfig = { ...state.config }
  const applied = cycle.apply(state.config, nextConfig, state.totalCycle)
  return {
    config: applied ? nextConfig : state.config,
    cycleIndex: applied ? (state.cycleIndex + 1) % cycles.length : state.cycleIndex,
    totalCycle: applied ? state.totalCycle + 1 : state.totalCycle,
    validLockCountAtLastCycleCheck: validLockedCantominoCount,
  }
}

export interface ClassicInfiniteSection {
  index: number
  firstRow: number
  pieces: readonly PlacedTetromino[]
}

type SectionGenerator = (index: number) => Promise<readonly PlacedTetromino[]>
type InfiniteConfigSource = ClassicInfiniteConfig | (() => ClassicInfiniteConfig)

/** Two active sections and one prepared replacement, regardless of run length. */
export class ClassicInfiniteStream {
  private activeSections: readonly ClassicInfiniteSection[] = []
  private prepared: ClassicInfiniteSection | null = null
  private offset: number
  private disposed = false
  private failed = false
  private nextIndex = 0
  private nextPieceId = 1
  private readonly config: ClassicInfiniteConfig
  private readonly generate: SectionGenerator
  private readonly onRecycle: (sections: readonly ClassicInfiniteSection[]) => void
  private readonly onError: (error: unknown) => void

  constructor(
    config: ClassicInfiniteConfig,
    generate: SectionGenerator,
    onRecycle: (sections: readonly ClassicInfiniteSection[]) => void,
    onError: (error: unknown) => void,
  ) {
    if (config.rows < config.visibleRows || config.visibleRows < 1 || !Number.isFinite(config.scrollRowsPerSecond) || config.scrollRowsPerSecond <= 0) {
      throw new Error('Infinite sections must cover the viewport and have a positive scrolling speed.')
    }
    this.config = config
    this.generate = generate
    this.onRecycle = onRecycle
    this.onError = onError
    // Begin at the section join: generated cells fill the upper half of the
    // viewport and the empty runway fills the lower half.
    this.offset = config.visibleRows / 2
  }

  get sections() { return this.activeSections }
  getOffsetRows = () => this.offset

  async start() {
    const bottom = await this.generateSection()
    if (this.disposed) return
    const top = await this.generateSection()
    if (this.disposed) return
    this.activeSections = [bottom, top]
    void this.prepareNext()
  }

  private async generateSection(): Promise<ClassicInfiniteSection> {
    const index = this.nextIndex++
    const firstRow = 0 - index * this.config.rows
    // Let a new Infinite run begin on a calm, empty board. The first generated
    // section is already waiting above it and scrolls into view next.
    if (index === 0) return { index, firstRow, pieces: [] }
    const pieces = await this.generate(index)
    return {
      index,
      firstRow,
      pieces: pieces.map((piece) => ({
        ...piece,
        id: this.nextPieceId++,
        cells: piece.cells.map((cell) => ({ ...cell, y: cell.y + firstRow })),
      })),
    }
  }

  private async prepareNext() {
    try {
      const section = await this.generateSection()
      if (!this.disposed) this.prepared = section
    } catch (error) {
      if (!this.disposed) {
        this.failed = true
        this.onError(error)
      }
    }
  }

  advance = (deltaMs: number) => {
    if (this.disposed || this.failed || this.activeSections.length !== 2 || !Number.isFinite(deltaMs) || deltaMs <= 0) return
    // A background tab or a stalled frame must not skip playable rows.
    const movement = Math.min(deltaMs, 100) / 1000 * this.config.scrollRowsPerSecond
    const bottom = this.activeSections[0]
    const recycleOffset = this.config.visibleRows - bottom.firstRow
    this.offset = Math.min(this.offset + movement, recycleOffset)
    if (this.offset < recycleOffset || !this.prepared) return

    this.activeSections = [this.activeSections[1], this.prepared]
    this.prepared = null
    this.onRecycle(this.activeSections)
    void this.prepareNext()
  }

  destroy() {
    this.disposed = true
    this.activeSections = []
    this.prepared = null
  }
}

export function createInfiniteSectionGenerator(configSource: InfiniteConfigSource, seed: string): SectionGenerator {
  return (index) => {
    const config = typeof configSource === 'function' ? configSource() : configSource
    return generateTetrominoPlacementsV2(config, {
      random: createSeededRandom(`classic-infinite:${seed}:${index}`),
      yieldEvery: 250,
    })
  }
}
