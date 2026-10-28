import { getTetrominoKind, TETROMINOES, type TetrominoKind } from '@/game/tetrominoes'
import { LOCKED_CELL_COLORS, pixiColorToCss } from '@/rendering/colors'
import { isVsLocalBoardSize, isVsTrapResolution, isVsWinCount, VS_LOCAL_CONFIG, VS_LOCAL_DEFAULT_BOARD_SIZE, type VsLocalBoardSize, type VsLocalConfig } from './vsLocalConfig'

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
  { id: 0, label: 'Player 1', lockedColor: LOCKED_CELL_COLORS[0], bannerBackground: '#176b83', bannerBorder: pixiColorToCss(LOCKED_CELL_COLORS[0]), bannerScoreBackground: '#2186a3' },
  { id: 1, label: 'Player 2', lockedColor: LOCKED_CELL_COLORS[4], bannerBackground: '#85303b', bannerBorder: pixiColorToCss(LOCKED_CELL_COLORS[4]), bannerScoreBackground: '#ad3e49' },
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
  boardSize?: VsLocalBoardSize
  history: VsMoveHistory
  pendingMoveDirection: VsMoveDirection
  pendingPlacement: VsPlacement | null
  /** Explicit claims on existing cells; the pending cell is considered contextually on confirmation. */
  selectedCellKeys: string[]
}

export function createVsLocalGame(random = Math.random, config: Readonly<Partial<VsLocalConfig> & { boardSize?: VsLocalBoardSize }> = {}): VsLocalGameState {
  const { allowHistoryRewrite, allowOverlappingCombinationWin, boardSize = VS_LOCAL_DEFAULT_BOARD_SIZE, combinationWinCount, consecutiveTurnWinCount, trapResolution } = { ...VS_LOCAL_CONFIG, ...config }
  if (typeof allowHistoryRewrite !== 'boolean') {
    throw new TypeError('Allow history rewrite must be a boolean.')
  }
  if (typeof allowOverlappingCombinationWin !== 'boolean') {
    throw new TypeError('Allow overlapping combination win must be a boolean.')
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
  if (!isVsLocalBoardSize(boardSize)) {
    throw new RangeError('Local VS board size must be 8, 9, or 10.')
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
    allowOverlappingCombinationWin,
    boardSize,
    combinationWinCount,
    consecutiveTurnWinCount,
    history: { positions: [position], index: 0 },
    pendingMoveDirection: 'orthogonal',
    pendingPlacement: null,
    selectedCellKeys: [],
    trapResolution,
  }
}

export function getVsHistoryPosition(state: VsLocalPosition): VsLocalPosition {
  const { activePlayer, captureStreak, lockedCornerominoes, nextMoveConstraint, placedCornerominoes, result } = state
  return { activePlayer, captureStreak, lockedCornerominoes, nextMoveConstraint, placedCornerominoes, result }
}

/** Refresh unused saved matches from code defaults; started matches keep their recorded rules. */
export function resumeVsLocalGame(savedGame: VsLocalGameState | null): VsLocalGameState {
  if (!savedGame) return createVsLocalGame()
  let migratedSelection = Array.isArray(savedGame.selectedCellKeys) ? savedGame : { ...savedGame, selectedCellKeys: [] }
  const pending = migratedSelection.pendingPlacement
  if (pending && migratedSelection.selectedCellKeys.includes(cellKey(pending.column, pending.row))) {
    // Older drafts allowed long-press selection of the pending cell.
    migratedSelection = { ...migratedSelection, selectedCellKeys: migratedSelection.selectedCellKeys.filter((key) => key !== cellKey(pending.column, pending.row)) }
  }
  const unstarted = migratedSelection.history.positions.length === 1
    && migratedSelection.placedCornerominoes.length === 0
    && migratedSelection.pendingPlacement === null
    && migratedSelection.result === null
  if (isVsLocalBoardSize(migratedSelection.boardSize)) {
    return unstarted ? { ...migratedSelection, ...VS_LOCAL_CONFIG } : migratedSelection
  }
  const migratedGame: VsLocalGameState = { ...migratedSelection, boardSize: VS_LOCAL_DEFAULT_BOARD_SIZE }
  return unstarted ? { ...migratedGame, ...VS_LOCAL_CONFIG } : migratedGame
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
    selectedCellKeys: [],
  }
}

/** A turn draft is local-only state and is never recorded in move history. */
export function hasVsTurnDraft(state: VsLocalGameState): boolean {
  return state.pendingPlacement !== null || state.pendingMoveDirection !== 'orthogonal' || state.selectedCellKeys.length > 0
}

/** Restore the current confirmed position without moving through history. */
export function cancelVsTurnDraft(state: VsLocalGameState): VsLocalGameState {
  if (!hasVsTurnDraft(state)) return state
  return {
    ...state,
    ...state.history.positions[state.history.index],
    pendingMoveDirection: 'orthogonal',
    pendingPlacement: null,
    selectedCellKeys: [],
  }
}

/** Previous first cancels a current draft; a clean position then moves back one confirmed turn. */
export function previousVsMove(state: VsLocalGameState): VsLocalGameState {
  const withoutDraft = cancelVsTurnDraft(state)
  return withoutDraft === state ? goToVsHistory(state, state.history.index - 1) : withoutDraft
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

function isInsideVsBoard(state: VsLocalGameState, column: number, row: number) {
  const boardSize = state.boardSize ?? VS_LOCAL_DEFAULT_BOARD_SIZE
  return column >= 0 && column < boardSize && row >= 0 && row < boardSize
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
  const boardSize = state.boardSize ?? VS_LOCAL_DEFAULT_BOARD_SIZE
  for (let row = 0; row < boardSize; row += 1) {
    for (let column = 0; column < boardSize; column += 1) {
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

/**
 * Finds every distinct valid shape containing the latest piece. It checks the
 * set of tetromino rotations anchored at that piece, instead of searching all
 * combinations of four cells on the board. Simultaneous shapes may overlap at
 * any cells; each shape counts as a capture, while shared cells score only once.
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

  return validShapes
}

export function findValidatedVsCellKeys(placed: readonly VsPlacedCorneromino[], latest: VsPlacedCorneromino, previouslyLocked: readonly VsLockedCorneromino[]): string[] {
  return [...new Set(findValidatedVsShapes(placed, latest, previouslyLocked).flat())]
}

/** Tap the pending cell to rotate, existing unlocked cells to select, or empty space to choose + or ×. */
export function selectVsCell(state: VsLocalGameState, column: number, row: number): VsLocalGameState {
  if (!canPlayVsTurn(state)) return state
  const pending = state.pendingPlacement
  // GridSurface centers the square board in a taller canvas; its letterbox bands
  // are intentional direction-toggle targets while a placement is pending.
  if (!isInsideVsBoard(state, column, row)) return pending ? toggleVsMoveDirection(state) : state
  if (pending?.column === column && pending.row === row) {
    return { ...state, pendingPlacement: { ...pending, corner: ((pending.corner + 1) % 4) as VsCorner } }
  }
  const placement = state.placedCornerominoes.find((item) => item.column === column && item.row === row)
  if (placement && placement.lockedBy === undefined) {
    const key = cellKey(column, row)
    return {
      ...state,
      selectedCellKeys: state.selectedCellKeys.includes(key)
        ? state.selectedCellKeys.filter((selectedKey) => selectedKey !== key)
        : [...state.selectedCellKeys, key],
    }
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

/** Cover the entire selection with one shape or an exact combination, sharing at most one junction cell. */
function findSelectedVsShapes(placed: readonly VsPlacedCorneromino[], selectedKeys: readonly string[], previouslyLocked: readonly VsLockedCorneromino[], player: VsPlayerId, combinationWinCount: number): string[][] {
  const selected = new Set(selectedKeys)
  if (selected.size !== selectedKeys.length || selected.size < 4) return []
  const wantedCount = selected.size === 4 ? 1 : combinationWinCount
  // A combination uses four cells per shape, or three new cells plus a shared junction.
  if (selected.size < wantedCount * 3 + 1 || selected.size > wantedCount * 4) return []
  const available = new Map(placed.filter((placement) => placement.lockedBy === undefined && selected.has(cellKey(placement.column, placement.row))).map((placement) => [cellKey(placement.column, placement.row), placement]))
  if (available.size !== selected.size) return []
  const friendlyShapes = indexFriendlyLockedShapes(previouslyLocked, player)
  const keys = [...selected]
  const candidates: string[][] = []
  for (let a = 0; a < keys.length; a += 1) for (let b = a + 1; b < keys.length; b += 1) for (let c = b + 1; c < keys.length; c += 1) for (let d = c + 1; d < keys.length; d += 1) {
    const shapeKeys = [keys[a], keys[b], keys[c], keys[d]]
    const shape = shapeKeys.map((key) => available.get(key)!)
    const kind = getTetrominoKind(shape.map(({ column, row }) => ({ x: column, y: row })))
    if (kind === null || new Set(shape.map((placement) => placement.corner)).size !== 4 || !matchesFriendlyShapeRule(shape, kind, friendlyShapes)) continue
    candidates.push(shapeKeys)
  }
  function search(remaining: Set<string>, chosen: string[][], sharedKey?: string): string[][] | null {
    if (remaining.size === 0) return chosen.length === wantedCount ? chosen : null
    if (chosen.length >= wantedCount) return null
    const shapesLeft = wantedCount - chosen.length
    if (remaining.size < shapesLeft * 3 || remaining.size > shapesLeft * 4) return null
    const first = remaining.values().next().value as string
    for (const candidate of candidates) {
      if (!candidate.includes(first)) continue
      const sharedCells = candidate.filter((key) => !remaining.has(key))
      if (sharedCells.length > 1 || (sharedCells.length === 1 && sharedKey !== undefined && sharedCells[0] !== sharedKey)) continue
      const next = new Set(remaining)
      candidate.forEach((key) => next.delete(key))
      const result = search(next, [...chosen, candidate], sharedKey ?? sharedCells[0])
      if (result) return result
    }
    return null
  }
  return search(selected, []) ?? []
}

function resolveVsTurn(state: VsLocalGameState, pending: VsPlacement): VsLocalGameState {
  const latest: VsPlacedCorneromino = { ...pending, player: state.activePlayer }
  const placedCornerominoes = [...state.placedCornerominoes, latest]
  const pendingKey = cellKey(pending.column, pending.row)
  const selectedKeys = state.selectedCellKeys.filter((key) => key !== pendingKey)
  // Prefer the explicit claim; include the pending cell only if the claim is otherwise invalid.
  let validatedShapes = findSelectedVsShapes(placedCornerominoes, selectedKeys, state.lockedCornerominoes, state.activePlayer, state.combinationWinCount)
  if (validatedShapes.length === 0) {
    validatedShapes = findSelectedVsShapes(placedCornerominoes, [...selectedKeys, pendingKey], state.lockedCornerominoes, state.activePlayer, state.combinationWinCount)
  }
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
  const combinationShapeCount = validatedShapes.length
  // Combination takes precedence if both victory conditions are met on this turn.
  const result: VsGameResult | null = combinationShapeCount >= state.combinationWinCount
    ? { reason: 'combination', shapeCount: combinationShapeCount, winner: state.activePlayer }
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
    selectedCellKeys: [],
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
