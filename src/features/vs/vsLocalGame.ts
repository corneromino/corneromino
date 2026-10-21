import { getTetrominoKind, TETROMINOES, type TetrominoKind } from '@/game/tetrominoes'
import { isVsTrapResolution, isVsWinCount, VS_LOCAL_CONFIG, type VsLocalConfig } from './vsLocalConfig'

export type VsCorner = 0 | 1 | 2 | 3
export type VsPlayerId = 0 | 1
export type VsMoveDirection = 'orthogonal' | 'diagonal'

export interface VsMoveConstraint {
  direction: VsMoveDirection
  originColumn: number
  originRow: number
}

/** Player identities and lock colours live here so future themes can change them in one place. */
export const VS_PLAYERS = [
  { id: 0, label: 'Player 1', lockedColor: 0x55c7df, bannerBackground: '#1e4a58', bannerBorder: '#55c7df', bannerScoreBackground: '#2a6173' },
  { id: 1, label: 'Player 2', lockedColor: 0xe4555c, bannerBackground: '#622d35', bannerBorder: '#e4555c', bannerScoreBackground: '#7d3b45' },
] as const satisfies readonly { id: VsPlayerId; label: string; lockedColor: number; bannerBackground: string; bannerBorder: string; bannerScoreBackground: string }[]

export interface VsPlacement {
  column: number
  corner: VsCorner
  row: number
}

export interface VsPlacedCorneromino extends VsPlacement {
  lockedBy?: VsPlayerId
  player: VsPlayerId
}

export interface VsLockedCorneromino {
  cellKeys: readonly string[]
  id: string
  player: VsPlayerId
}

export interface VsCombinationVictory {
  reason: 'combination'
  shapeCount: number
  winner: VsPlayerId
}

export interface VsConsecutiveTurnVictory {
  reason: 'consecutive-turns'
  turnCount: number
  winner: VsPlayerId
}

export interface VsTrapResult {
  reason: 'trap'
  winner: VsPlayerId | null
}

export interface VsNoLegalMovesDraw {
  reason: 'no-legal-moves'
  winner: null
}

export type VsGameResult = VsCombinationVictory | VsConsecutiveTurnVictory | VsTrapResult | VsNoLegalMovesDraw

/** Only one player can have a streak: an opponent capture replaces it. */
export interface VsCaptureStreak {
  player: VsPlayerId
  turnCount: number
}

/** A committed board position; drafts and match settings are not history entries. */
export interface VsLocalPosition {
  activePlayer: VsPlayerId
  captureStreak: VsCaptureStreak | null
  lockedCornerominoes: VsLockedCorneromino[]
  nextMoveConstraint: VsMoveConstraint | null
  placedCornerominoes: VsPlacedCorneromino[]
  result: VsGameResult | null
}

export interface VsMoveHistory {
  /** Includes the starting position, followed by one position per confirmed turn. */
  positions: readonly VsLocalPosition[]
  index: number
}

export interface VsLocalGameState extends VsLocalPosition, VsLocalConfig {
  history: VsMoveHistory
  pendingMoveDirection: VsMoveDirection
  pendingPlacement: VsPlacement | null
}

export function createVsLocalGame(random = Math.random, config: Readonly<Partial<VsLocalConfig>> = {}): VsLocalGameState {
  const { allowHistoryRewrite, combinationWinCount, consecutiveTurnWinCount, trapResolution } = { ...VS_LOCAL_CONFIG, ...config }
  if (typeof allowHistoryRewrite !== 'boolean') {
    throw new TypeError('Allow history rewrite must be a boolean.')
  }
  if (!isVsWinCount(combinationWinCount)) {
    throw new RangeError('Combination victory requires an integer of at least 2 tetrominoes.')
  }
  if (!isVsWinCount(consecutiveTurnWinCount)) {
    throw new RangeError('Consecutive-turn victory requires an integer of at least 2 turns.')
  }
  if (!isVsTrapResolution(trapResolution)) {
    throw new RangeError('Trap resolution must be points or draw.')
  }
  const position: VsLocalPosition = {
    activePlayer: random() < 0.5 ? 0 : 1,
    captureStreak: null,
    lockedCornerominoes: [],
    nextMoveConstraint: null,
    placedCornerominoes: [],
    result: null,
  }
  return {
    ...position,
    allowHistoryRewrite,
    combinationWinCount,
    consecutiveTurnWinCount,
    history: { positions: [position], index: 0 },
    pendingMoveDirection: 'orthogonal',
    pendingPlacement: null,
    trapResolution,
  }
}

export function getVsHistoryPosition(state: VsLocalPosition): VsLocalPosition {
  const { activePlayer, captureStreak, lockedCornerominoes, nextMoveConstraint, placedCornerominoes, result } = state
  return { activePlayer, captureStreak, lockedCornerominoes, nextMoveConstraint, placedCornerominoes, result }
}

export function canPlayVsTurn(state: VsLocalGameState): boolean {
  return state.result === null && (state.allowHistoryRewrite || state.history.index === state.history.positions.length - 1)
}

/** Browsing discards the unconfirmed draft, but keeps the entire future until confirmation. */
export function goToVsHistory(state: VsLocalGameState, index: number): VsLocalGameState {
  if (!Number.isInteger(index) || index < 0 || index >= state.history.positions.length || index === state.history.index) return state
  return {
    ...state,
    ...state.history.positions[index],
    history: { ...state.history, index },
    pendingMoveDirection: 'orthogonal',
    pendingPlacement: null,
  }
}

/** Ownership is stored once per board cell, even when lock groups share that cell. */
export function getVsPlayerScores(placed: readonly VsPlacedCorneromino[]): [number, number] {
  const scores: [number, number] = [0, 0]
  for (const placement of placed) {
    if (placement.lockedBy !== undefined) scores[placement.lockedBy] += 1
  }
  return scores
}

function isOccupied(state: VsLocalGameState, column: number, row: number) {
  return state.placedCornerominoes.some((placement) => placement.column === column && placement.row === row)
}

function isInsideVsBoard(column: number, row: number) {
  return column >= 0 && column < 10 && row >= 0 && row < 10
}

function matchesVsMoveConstraint(constraint: VsMoveConstraint, column: number, row: number) {
  const horizontalDistance = Math.abs(column - constraint.originColumn)
  const verticalDistance = Math.abs(row - constraint.originRow)
  if (horizontalDistance === 0 && verticalDistance === 0) return false
  return constraint.direction === 'orthogonal'
    ? horizontalDistance === 0 || verticalDistance === 0
    : horizontalDistance === verticalDistance
}

/** Empty cells the current player may use under the previous player's restriction. */
export function getVsAllowedCells(state: VsLocalGameState): Array<{ column: number; row: number }> {
  if (state.result) return []
  const allowedCells: Array<{ column: number; row: number }> = []
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      if (isOccupied(state, column, row)) continue
      if (state.nextMoveConstraint && !matchesVsMoveConstraint(state.nextMoveConstraint, column, row)) continue
      allowedCells.push({ column, row })
    }
  }
  return allowedCells
}

/** Visible targets exist only after a player has committed a direction. */
export function getVsTargetedCells(state: VsLocalGameState): Array<{ column: number; row: number }> {
  return state.nextMoveConstraint ? getVsAllowedCells(state) : []
}

/** Faded preview of the cells the current player's selected rule will allow next turn. */
export function getVsNextTurnPreviewCells(state: VsLocalGameState): Array<{ column: number; row: number }> {
  const pending = state.pendingPlacement
  if (state.result || !pending) return []
  return getVsAllowedCells({
    ...state,
    nextMoveConstraint: {
      direction: state.pendingMoveDirection,
      originColumn: pending.column,
      originRow: pending.row,
    },
    placedCornerominoes: [...state.placedCornerominoes, { ...pending, player: state.activePlayer }],
  })
}

function cellKey(column: number, row: number) {
  return `${column},${row}`
}

const CORNEROMINO_PATTERNS = [...new Map(
  Object.values(TETROMINOES)
    .flatMap((tetromino) => tetromino.rotations.map((rotation) => ({ kind: tetromino.kind, cells: rotation.cells })))
    .map((pattern) => [pattern.cells.map(({ x, y }) => cellKey(x, y)).sort().join('|'), pattern] as const),
).values()]

const ORTHOGONAL_NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const

function indexFriendlyLockedShapes(groups: readonly VsLockedCorneromino[], player: VsPlayerId): Map<string, Set<TetrominoKind>> {
  const index = new Map<string, Set<TetrominoKind>>()
  for (const group of groups) {
    if (group.player !== player) continue
    // Stored group coordinates also identify shapes from existing saved games.
    const kind = getTetrominoKind(group.cellKeys.map((key) => {
      const [x, y] = key.split(',').map(Number)
      return { x, y }
    }))
    if (kind === null) continue
    for (const key of group.cellKeys) {
      const kinds = index.get(key) ?? new Set<TetrominoKind>()
      kinds.add(kind)
      index.set(key, kinds)
    }
  }
  return index
}

function matchesFriendlyShapeRule(cells: readonly VsPlacement[], kind: TetrominoKind, friendlyShapes: ReadonlyMap<string, ReadonlySet<TetrominoKind>>): boolean {
  let touchesFriendlyShape = false
  for (const { column, row } of cells) {
    for (const [dx, dy] of ORTHOGONAL_NEIGHBORS) {
      const neighboringKinds = friendlyShapes.get(cellKey(column + dx, row + dy))
      if (!neighboringKinds) continue
      if (neighboringKinds.has(kind)) return true
      touchesFriendlyShape = true
    }
  }
  return !touchesFriendlyShape
}

interface ShapeCandidate {
  cellKeys: string[]
  /** Only the three non-shared cells participate in conflict checks. */
  mask: bigint
}

function countBits(mask: bigint): number {
  let count = 0
  while (mask !== 0n) {
    mask &= mask - 1n
    count += 1
  }
  return count
}

/** Exact local set-packing search; equal-scoring solutions keep template order. */
function selectMaximumVsShapes(
  shapes: string[][],
  available: ReadonlyMap<string, VsPlacedCorneromino>,
  latestKey: string,
): string[][] {
  if (shapes.length <= 1) return shapes

  const cellBits = new Map<string, bigint>()
  const cornerMasks = [0n, 0n, 0n, 0n]
  const candidates = shapes.map((cellKeys): ShapeCandidate => {
    let mask = 0n
    for (const key of cellKeys) {
      if (key === latestKey) continue
      let bit = cellBits.get(key)
      if (bit === undefined) {
        bit = 1n << BigInt(cellBits.size)
        cellBits.set(key, bit)
        const corner = available.get(key)!.corner
        cornerMasks[corner] |= bit
      }
      mask |= bit
    }
    return { cellKeys, mask }
  })
  const requiredCornerMasks = cornerMasks.filter((mask) => mask !== 0n)
  const selected: string[][] = []
  let best: string[][] = []

  function search(remaining: readonly ShapeCandidate[]) {
    if (selected.length > best.length) best = [...selected]
    if (selected.length + remaining.length <= best.length) return

    // Each shape needs one distinct cell of each of the three other corners.
    // The scarcest corner bounds how many more shapes any branch can lock.
    const remainingCells = remaining.reduce((mask, candidate) => mask | candidate.mask, 0n)
    const upperBound = Math.min(remaining.length, ...requiredCornerMasks.map((mask) => countBits(mask & remainingCells)))
    if (selected.length + upperBound <= best.length) return

    for (let index = 0; index < remaining.length; index += 1) {
      if (selected.length + remaining.length - index <= best.length) break
      const candidate = remaining[index]!
      const compatible = remaining.slice(index + 1).filter((other) => (candidate.mask & other.mask) === 0n)
      selected.push(candidate.cellKeys)
      search(compatible)
      selected.pop()
      if (selected.length + upperBound <= best.length) break
    }
  }

  search(candidates)
  return best
}

/**
 * Finds valid shapes containing the latest piece. It checks only the constant
 * set of tetromino rotations anchored at that piece, instead of searching all
 * combinations of four cells on the board, then chooses the largest compatible
 * set. Shapes may share only the latest cell: N shapes lock exactly 1 + 3N cells.
 * Only friendly shapes locked before this turn impose adjacency restrictions.
 */
export function findValidatedVsShapes(placed: readonly VsPlacedCorneromino[], latest: VsPlacedCorneromino, previouslyLocked: readonly VsLockedCorneromino[]): string[][] {
  const available = new Map(placed.filter((placement) => placement.lockedBy === undefined).map((placement) => [cellKey(placement.column, placement.row), placement]))
  const friendlyShapes = indexFriendlyLockedShapes(previouslyLocked, latest.player)
  const validShapes: string[][] = []
  const seenShapes = new Set<string>()

  for (const { cells: pattern, kind } of CORNEROMINO_PATTERNS) {
    for (const pivot of pattern) {
      const offsetColumn = latest.column - pivot.x
      const offsetRow = latest.row - pivot.y
      const shape = pattern.map(({ x, y }) => available.get(cellKey(offsetColumn + x, offsetRow + y)))
      if (shape.some((placement) => placement === undefined)) continue
      const completedShape = shape as VsPlacedCorneromino[]
      if (new Set(completedShape.map((placement) => placement.corner)).size !== 4) continue
      if (!matchesFriendlyShapeRule(completedShape, kind, friendlyShapes)) continue
      const shapeKey = completedShape.map((placement) => cellKey(placement.column, placement.row)).sort().join('|')
      if (seenShapes.has(shapeKey)) continue
      seenShapes.add(shapeKey)
      validShapes.push(completedShape.map((placement) => cellKey(placement.column, placement.row)))
    }
  }

  return selectMaximumVsShapes(validShapes, available, cellKey(latest.column, latest.row))
}

export function findValidatedVsCellKeys(placed: readonly VsPlacedCorneromino[], latest: VsPlacedCorneromino, previouslyLocked: readonly VsLockedCorneromino[]): string[] {
  return [...new Set(findValidatedVsShapes(placed, latest, previouslyLocked).flat())]
}

/** Places a fixed corner at top-right. Tap it to rotate; tap elsewhere to choose + or ×. */
export function selectVsCell(state: VsLocalGameState, column: number, row: number): VsLocalGameState {
  if (!canPlayVsTurn(state)) return state
  const pending = state.pendingPlacement
  if (!isInsideVsBoard(column, row)) return state
  if (pending?.column === column && pending.row === row) {
    return { ...state, pendingPlacement: { ...pending, corner: ((pending.corner + 1) % 4) as VsCorner } }
  }
  if (pending) return toggleVsMoveDirection(state)
  if (isOccupied(state, column, row)) return state
  if (state.nextMoveConstraint && !matchesVsMoveConstraint(state.nextMoveConstraint, column, row)) return state
  return { ...state, pendingPlacement: { column, row, corner: 1 } }
}

export function toggleVsMoveDirection(state: VsLocalGameState): VsLocalGameState {
  if (!canPlayVsTurn(state) || !state.pendingPlacement) return state
  return { ...state, pendingMoveDirection: state.pendingMoveDirection === 'orthogonal' ? 'diagonal' : 'orthogonal' }
}

export function finishVsTurn(state: VsLocalGameState): VsLocalGameState {
  const pending = state.pendingPlacement
  if (!canPlayVsTurn(state) || !pending) return state
  const nextState = resolveVsTurn(state, pending)
  return {
    ...nextState,
    history: {
      positions: [
        ...state.history.positions.slice(0, state.history.index),
        getVsHistoryPosition(state),
        getVsHistoryPosition(nextState),
      ],
      index: state.history.index + 1,
    },
  }
}

function resolveVsTurn(state: VsLocalGameState, pending: VsPlacement): VsLocalGameState {
  const latest: VsPlacedCorneromino = { ...pending, player: state.activePlayer }
  const placedCornerominoes = [...state.placedCornerominoes, latest]
  const validatedShapes = findValidatedVsShapes(placedCornerominoes, latest, state.lockedCornerominoes)
  const validatedCellKeys = new Set(validatedShapes.flat())
  const lockedCornerominoes = [
    ...state.lockedCornerominoes,
    ...validatedShapes.map((cellKeys, index) => ({
      cellKeys,
      id: `lock:${state.lockedCornerominoes.length + index + 1}`,
      player: state.activePlayer,
    })),
  ]
  // A capture counts as one turn, regardless of the number of shapes locked.
  // Missing on your own turn ends your streak; an opponent miss leaves it intact.
  const captureStreak: VsCaptureStreak | null = validatedShapes.length > 0
    ? { player: state.activePlayer, turnCount: state.captureStreak?.player === state.activePlayer ? state.captureStreak.turnCount + 1 : 1 }
    : state.captureStreak?.player === state.activePlayer ? null : state.captureStreak
  // Combination takes precedence if both victory conditions are met on this turn.
  const result: VsGameResult | null = validatedShapes.length >= state.combinationWinCount
    ? { reason: 'combination', shapeCount: validatedShapes.length, winner: state.activePlayer }
    : validatedShapes.length > 0 && captureStreak && captureStreak.turnCount >= state.consecutiveTurnWinCount
      ? { reason: 'consecutive-turns', turnCount: captureStreak.turnCount, winner: state.activePlayer }
      : null
  const nextState: VsLocalGameState = {
    ...state,
    activePlayer: result ? state.activePlayer : state.activePlayer === 0 ? 1 : 0,
    captureStreak,
    combinationWinCount: state.combinationWinCount,
    consecutiveTurnWinCount: state.consecutiveTurnWinCount,
    lockedCornerominoes,
    nextMoveConstraint: {
      direction: state.pendingMoveDirection,
      originColumn: pending.column,
      originRow: pending.row,
    },
    pendingMoveDirection: 'orthogonal',
    pendingPlacement: null,
    placedCornerominoes: placedCornerominoes.map((placement) => (
      validatedCellKeys.has(cellKey(placement.column, placement.row))
        ? { ...placement, lockedBy: state.activePlayer }
        : placement
    )),
    result,
    trapResolution: state.trapResolution,
  }
  // Immediate victories take priority; only inspect opponent mobility after the
  // placement, ownership updates, and selected direction have all been committed.
  if (result || getVsAllowedCells(nextState).length > 0) return nextState

  const [playerOnePoints, playerTwoPoints] = getVsPlayerScores(nextState.placedCornerominoes)
  const winner = state.trapResolution === 'draw' || playerOnePoints === playerTwoPoints
    ? null
    : playerOnePoints > playerTwoPoints ? 0 : 1
  return {
    ...nextState,
    activePlayer: state.activePlayer,
    result: validatedShapes.length > 0
      ? { reason: 'trap', winner }
      : { reason: 'no-legal-moves', winner: null },
  }
}
