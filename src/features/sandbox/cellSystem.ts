export interface SandboxCornerState {
  corner: number
  isOn: boolean
  sourceKey: string | null
}

export interface SandboxCornerMarker extends Partial<SandboxCornerState> {
  cellKey: string
  corner: number
}

export type SandboxCellUpdateHandler = (
  system: SandboxCellSystem,
  cellKey: string,
  state: Readonly<SandboxCornerState>,
  previousState: Readonly<SandboxCornerState> | undefined,
) => boolean

interface SandboxCellRecord {
  state: Readonly<SandboxCornerState>
  neighborKeys: readonly string[]
}

const CORNER_COUNT = 4
const TOP_RIGHT_CORNER = 1
const NEIGHBOR_OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  // diagonal
  { x: -1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
] as const
const EMPTY_NEIGHBOR_KEYS: readonly string[] = Object.freeze([])

function createNeighborKeys(cellKey: string): readonly string[] {
  const separator = cellKey.indexOf(',')
  const x = Number(cellKey.slice(0, separator))
  const y = Number(cellKey.slice(separator + 1))
  return Object.freeze(NEIGHBOR_OFFSETS.map((offset) => `${x + offset.x},${y + offset.y}`))
}

export const updatePowerStateFromNeighbors: SandboxCellUpdateHandler = (system, cellKey, state, previousState) => {
  const activatingOffCorner = (state.corner + 1) % CORNER_COUNT
  const neighborKeys = system.getNeighborKeys(cellKey)
  let sourceKey: string | null = null

  // Preserve the rule's last-match priority (left, bottom, right, top),
  // stopping as soon as that highest-priority source is found.
  for (let index = neighborKeys.length - 1; index >= 0; index -= 1) {
    const neighborCellKey = neighborKeys[index]
    const neighborState = system.getState(neighborCellKey)
    if (!neighborState || neighborState.sourceKey === cellKey) continue
    if ((neighborState.corner === state.corner && neighborState.isOn)
      || (neighborState.corner === activatingOffCorner && !neighborState.isOn)) {
      sourceKey = neighborCellKey
      break
    }
  }

  const isOn = sourceKey !== null
  if (state.isOn !== isOn || state.sourceKey !== sourceKey) {
    system.setCornerStateFromUpdate(cellKey, { corner: state.corner, isOn, sourceKey })
  }
  return previousState === undefined
    || previousState.corner !== state.corner
    || previousState.isOn !== isOn
    || previousState.sourceKey !== sourceKey
}

export class SandboxCellSystem {
  private readonly cells = new Map<string, SandboxCellRecord>()
  // A growable ring buffer preserves every notification, including duplicates
  // and replies to the sender, without allocating objects or splicing arrays.
  private pendingUpdates: Array<string | undefined> = new Array(256)
  private pendingUpdateHead = 0
  private pendingUpdateCount = 0
  private readonly updateHandlers: readonly SandboxCellUpdateHandler[]

  constructor(markers: readonly SandboxCornerMarker[], updateHandlers: readonly SandboxCellUpdateHandler[] = []) {
    for (const marker of markers) {
      this.cells.set(marker.cellKey, {
        state: Object.freeze({
          corner: marker.corner,
          isOn: marker.isOn ?? false,
          sourceKey: marker.sourceKey ?? null,
        }),
        neighborKeys: createNeighborKeys(marker.cellKey),
      })
    }
    this.updateHandlers = updateHandlers
  }

  getMarkers(): SandboxCornerMarker[] {
    const markers: SandboxCornerMarker[] = []
    for (const [cellKey, cell] of this.cells) markers.push({ cellKey, ...cell.state })
    return markers
  }

  /** Snapshots remain immutable and valid after later state writes. */
  getState(cellKey: string): Readonly<SandboxCornerState> | undefined {
    return this.cells.get(cellKey)?.state
  }

  /** Cached geometric neighbors in top, right, bottom, left order. */
  getNeighborKeys(cellKey: string): readonly string[] {
    return this.cells.get(cellKey)?.neighborKeys ?? EMPTY_NEIGHBOR_KEYS
  }

  setCornerStateFromUpdate(cellKey: string, state: SandboxCornerState): void {
    const cell = this.cells.get(cellKey)
    if (cell) cell.state = Object.freeze({ ...state })
  }

  rotateCornerFromUser(cellKey: string): void {
    let cell = this.cells.get(cellKey)
    const previousState = cell?.state
    const currentCorner = previousState?.corner
    const nextCorner = currentCorner === undefined ? TOP_RIGHT_CORNER : (currentCorner + 1) % CORNER_COUNT
    const state = Object.freeze({ corner: nextCorner, isOn: false, sourceKey: null })
    if (cell) {
      cell.state = state
    } else {
      cell = { state, neighborKeys: createNeighborKeys(cellKey) }
      this.cells.set(cellKey, cell)
    }
    if (this.runUpdateHandlers(cellKey, previousState)) this.sendUpdateToNeighbors(cell.neighborKeys)
  }

  removeCornerFromUser(cellKey: string): void {
    const cell = this.cells.get(cellKey)
    if (!cell) return
    this.cells.delete(cellKey)
    this.sendUpdateToNeighbors(cell.neighborKeys)
  }

  /** Atomically relocate user-owned cells while retaining their corner state. */
  moveCornerStatesFromUser(moves: readonly { fromCellKey: string; state: SandboxCornerState; toCellKey: string }[], removeSources = true): void {
    const sourceKeys = new Set(moves.map((move) => move.fromCellKey))
    const affectedNeighborKeys: string[] = []
    if (removeSources) {
      for (const sourceKey of sourceKeys) {
        const source = this.cells.get(sourceKey)
        if (!source) continue
        this.cells.delete(sourceKey)
        affectedNeighborKeys.push(...source.neighborKeys)
      }
    }

    for (const move of moves) {
      const previousState = this.cells.get(move.toCellKey)?.state
      const cell: SandboxCellRecord = {
        state: Object.freeze({ ...move.state }),
        neighborKeys: createNeighborKeys(move.toCellKey),
      }
      this.cells.set(move.toCellKey, cell)
      if (this.runUpdateHandlers(move.toCellKey, previousState)) this.sendUpdateToNeighbors(cell.neighborKeys)
    }
    if (removeSources) this.sendUpdateToNeighbors(affectedNeighborKeys)
  }

  hasPendingUpdates(): boolean {
    return this.pendingUpdateCount > 0
  }

  /** Process this tick's queued notifications; new broadcasts wait until the next tick. */
  processTick(maximumUpdates = Infinity, timeBudgetMs = Infinity): number {
    const updateCount = Math.min(maximumUpdates, this.pendingUpdateCount)
    if (updateCount <= 0 || timeBudgetMs <= 0) return 0
    const deadline = timeBudgetMs === Infinity ? Infinity : performance.now() + timeBudgetMs
    let processed = 0
    do {
      processed += this.processUpdates(Math.min(64, updateCount - processed))
    } while (processed < updateCount && (deadline === Infinity || performance.now() < deadline))
    return processed
  }

  processUpdates(maximumUpdates: number): number {
    let processedUpdates = 0

    while (processedUpdates < maximumUpdates && this.pendingUpdateCount > 0) {
      const cellKey = this.pendingUpdates[this.pendingUpdateHead]!
      this.pendingUpdates[this.pendingUpdateHead] = undefined
      this.pendingUpdateHead = (this.pendingUpdateHead + 1) % this.pendingUpdates.length
      this.pendingUpdateCount -= 1
      this.receiveUpdate(cellKey)
      processedUpdates += 1
    }

    return processedUpdates
  }

  private receiveUpdate(cellKey: string): void {
    const cell = this.cells.get(cellKey)
    if (cell && this.runUpdateHandlers(cellKey, cell.state)) this.sendUpdateToNeighbors(cell.neighborKeys)
  }

  private runUpdateHandlers(cellKey: string, previousState: Readonly<SandboxCornerState> | undefined): boolean {
    let shouldUpdateNeighbors = false
    for (const updateHandler of this.updateHandlers) {
      const state = this.getState(cellKey)
      if (!state) break
      if (updateHandler(this, cellKey, state, previousState)) shouldUpdateNeighbors = true
    }
    return shouldUpdateNeighbors
  }

  private sendUpdateToNeighbors(neighborKeys: readonly string[]): void {
    for (const neighborCellKey of neighborKeys) {
      if (!this.cells.has(neighborCellKey)) continue
      if (this.pendingUpdateCount === this.pendingUpdates.length) this.growUpdateQueue()
      const tail = (this.pendingUpdateHead + this.pendingUpdateCount) % this.pendingUpdates.length
      this.pendingUpdates[tail] = neighborCellKey
      this.pendingUpdateCount += 1
    }
  }

  private growUpdateQueue(): void {
    const expanded: Array<string | undefined> = new Array(this.pendingUpdates.length * 2)
    for (let index = 0; index < this.pendingUpdateCount; index += 1) {
      expanded[index] = this.pendingUpdates[(this.pendingUpdateHead + index) % this.pendingUpdates.length]
    }
    this.pendingUpdates = expanded
    this.pendingUpdateHead = 0
  }
}
