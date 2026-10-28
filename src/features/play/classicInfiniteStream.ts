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
  tetrominoCount: 10,
  spread: 0.2,
  lockingMode: 'auto',
  finalVerificationMode: 'auto',
  navigationEnabled: false,
  visibleRows: 13,
  scrollRowsPerSecond: 1,
}

export interface ClassicInfiniteSection {
  index: number
  firstRow: number
  pieces: readonly PlacedTetromino[]
}

type SectionGenerator = (index: number) => Promise<readonly PlacedTetromino[]>

/** Two active sections and one prepared replacement, regardless of run length. */
export class ClassicInfiniteStream {
  private activeSections: readonly ClassicInfiniteSection[] = []
  private prepared: ClassicInfiniteSection | null = null
  private offset: number
  private disposed = false
  private failed = false
  private nextIndex = 0
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
        id: index * this.config.tetrominoCount + piece.id,
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

export function createInfiniteSectionGenerator(config: ClassicInfiniteConfig, seed: string): SectionGenerator {
  return (index) => generateTetrominoPlacementsV2(config, {
    random: createSeededRandom(`classic-infinite:${seed}:${index}`),
    yieldEvery: 250,
  })
}
