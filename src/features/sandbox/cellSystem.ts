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

interface PendingCellUpdate {
  cellKey: string
}

const CORNER_COUNT = 4
const TOP_RIGHT_CORNER = 1
const NEIGHBOR_OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const

function parseCellKey(cellKey: string) {
  const [x, y] = cellKey.split(',').map(Number)
  return { x, y }
}

export const updatePowerStateFromNeighbors: SandboxCellUpdateHandler = (system, cellKey, state, previousState) => {
  const { x, y } = parseCellKey(cellKey);
  const activatingOffCorner = (state.corner + 1) % CORNER_COUNT;

  
  let newState: SandboxCornerState = {
    corner: state.corner,
    isOn: false,
    sourceKey: null
  };

  for (const offset of NEIGHBOR_OFFSETS) {
    const neighborCellKey = `${x + offset.x},${y + offset.y}`;
    const neighborState = system.getState(neighborCellKey);
    if (neighborState && neighborState.sourceKey != cellKey) {
      if ((neighborState?.corner === state.corner && neighborState.isOn) ||
          (neighborState?.corner === activatingOffCorner && !neighborState.isOn)) {
        newState.isOn = true;
        newState.sourceKey = neighborCellKey;
      }
    }
  }


  // const source = NEIGHBOR_OFFSETS.map((offset) => {
  //   const neighborCellKey = `${x + offset.x},${y + offset.y}`
  //   return { neighborCellKey, neighborState: system.getState(neighborCellKey) }
  // }).find(({ neighborState }) => (
  //   (neighborState?.corner === state.corner && neighborState.isOn)
  //   || (neighborState?.corner === activatingOffCorner && !neighborState.isOn)
  // ))
  system.setCornerStateFromUpdate(cellKey, newState)
  return previousState === undefined
    || previousState.corner !== newState.corner
    || previousState.isOn !== newState.isOn
    || previousState.sourceKey !== newState.sourceKey
}

export class SandboxCellSystem {
  private readonly cornerMarkers: Map<string, SandboxCornerState>
  private pendingUpdateIndex = 0
  private readonly pendingUpdates: PendingCellUpdate[] = []
  private readonly updateHandlers: readonly SandboxCellUpdateHandler[]

  constructor(markers: readonly SandboxCornerMarker[], updateHandlers: readonly SandboxCellUpdateHandler[] = []) {
    this.cornerMarkers = new Map(markers.map((marker) => [marker.cellKey, {
      corner: marker.corner,
      isOn: marker.isOn ?? false,
      sourceKey: marker.sourceKey ?? null,
    }]))
    this.updateHandlers = updateHandlers
  }

  getMarkers(): SandboxCornerMarker[] {
    return [...this.cornerMarkers].map(([cellKey, marker]) => ({
      cellKey,
      corner: marker.corner,
      isOn: marker.isOn,
      sourceKey: marker.sourceKey,
    }))
  }

  getState(cellKey: string): Readonly<SandboxCornerState> | undefined {
    const state = this.cornerMarkers.get(cellKey)
    return state ? Object.freeze({ ...state }) : undefined
  }

  setCornerStateFromUpdate(cellKey: string, state: SandboxCornerState): void {
    if (!this.cornerMarkers.has(cellKey)) return
    this.cornerMarkers.set(cellKey, { ...state })
  }

  rotateCornerFromUser(cellKey: string): void {
    const previousState = this.getState(cellKey)
    const currentCorner = previousState?.corner
    const nextCorner = currentCorner === undefined ? TOP_RIGHT_CORNER : (currentCorner + 1) % CORNER_COUNT
    this.cornerMarkers.set(cellKey, { corner: nextCorner, isOn: false, sourceKey: null })
    if (this.runUpdateHandlers(cellKey, previousState)) this.sendUpdateToNeighbors(cellKey)
  }

  removeCornerFromUser(cellKey: string): void {
    if (!this.cornerMarkers.delete(cellKey)) return
    this.sendUpdateToNeighbors(cellKey)
  }

  hasPendingUpdates(): boolean {
    return this.pendingUpdateIndex < this.pendingUpdates.length
  }

  processUpdates(maximumUpdates: number): number {
    let processedUpdates = 0

    while (processedUpdates < maximumUpdates && this.hasPendingUpdates()) {
      const update = this.pendingUpdates[this.pendingUpdateIndex]
      this.pendingUpdateIndex += 1
      if (update) this.receiveUpdate(update.cellKey)
      processedUpdates += 1
    }

    if (this.pendingUpdateIndex > 1024 && this.pendingUpdateIndex * 2 > this.pendingUpdates.length) {
      this.pendingUpdates.splice(0, this.pendingUpdateIndex)
      this.pendingUpdateIndex = 0
    }

    return processedUpdates
  }

  private receiveUpdate(cellKey: string): void {
    if (!this.cornerMarkers.has(cellKey)) return

    const markerBeforeUpdate = this.cornerMarkers.get(cellKey)
    if (!markerBeforeUpdate) return
    if (this.runUpdateHandlers(cellKey, markerBeforeUpdate)) this.sendUpdateToNeighbors(cellKey)
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

  private sendUpdateToNeighbors(cellKey: string): void {
    const { x, y } = parseCellKey(cellKey)

    for (const offset of NEIGHBOR_OFFSETS) {
      const neighborCellKey = `${x + offset.x},${y + offset.y}`
      if (!this.cornerMarkers.has(neighborCellKey)) continue
      this.pendingUpdates.push({ cellKey: neighborCellKey })
    }
  }
}
