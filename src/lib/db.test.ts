import { beforeEach, describe, expect, it, vi } from 'vitest'

const records = vi.hoisted(() => new Map<string, { id: string; state: unknown; updatedAt: number }>())

vi.mock('./gameDatabase', () => ({
  openGameDatabase: async () => ({
    get: async (_store: string, key: string) => records.get(key),
    put: async (_store: string, value: { id: string; state: unknown; updatedAt: number }) => { records.set(value.id, value) },
    delete: async (_store: string, key: string) => { records.delete(key) },
    getAll: async () => [...records.values()],
  }),
}))

import { clearVsLocalGameState, db, loadClassicGameDefinition, loadSavedGames, loadVsLocalGameState, saveClassicGameDefinition, saveGameSelection, saveVsLocalGameState, type ClassicGameDefinition, type VsLocalGameSaveState } from './db'
import { canPlayVsTurn, createVsLocalGame, finishVsTurn, getVsHistoryPosition, goToVsHistory, selectVsCell, toggleVsMoveDirection } from '@/features/vs/vsLocalGame'
import type { VsTrapResolution } from '@/features/vs/vsLocalConfig'

function finishedVsGame() {
  const game = createVsLocalGame(() => 1, { combinationWinCount: 3 })
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) {
    for (const corner of [1, 2, 3] as const) {
      game.placedCells.push({ column: 4 + dx * corner, row: 4 + dy * corner, corner, player: 0 })
    }
  }
  return finishVsTurn({ ...game, pendingPlacement: { column: 4, row: 4, corner: 0 } })
}

function trappedVsGame(trapResolution: VsTrapResolution, capture = true, opponentShapes = 0) {
  const game = createVsLocalGame(() => 0, { trapResolution })
  game.pendingPlacement = { column: 0, row: 0, corner: 0 }
  game.pendingMoveDirection = 'diagonal'
  for (let index = 1; index < 10; index += 1) {
    game.placedCells.push({ column: index, row: index, corner: capture && index === 1 ? 1 : capture && index === 2 ? 2 : 3, player: 1 })
  }
  for (let index = 0; index < opponentShapes; index += 1) {
    const row = 1 + index * 3
    const cells = [[6, row, 0], [7, row, 1], [6, row + 1, 2], [7, row + 1, 3]] as const
    game.lockedShapes.push({ id: `old:${index}`, player: 1, cellKeys: cells.map(([x, y]) => `${x},${y}`) })
    for (const [column, row, corner] of cells) game.placedCells.push({ column, row, corner, player: 0, lockedBy: 1 })
  }
  return finishVsTurn(game)
}

function classicDefinition(): ClassicGameDefinition {
  return {
    config: { columns: 4, lockingMode: 'auto', rows: 4, spread: 0, tetrominoCount: 1 },
    gameMode: 'c001',
    pieces: [{
      cells: [
        { cellId: 'a', corner: 'top-left', x: 1, y: 1 },
        { cellId: 'b', corner: 'top-right', x: 2, y: 1 },
        { cellId: 'c', corner: 'bottom-right', x: 1, y: 2 },
        { cellId: 'd', corner: 'bottom-left', x: 2, y: 2 },
      ],
      id: 1,
      kind: 'O',
    }],
    seed: 'classic-definition-seed',
    version: 1,
  }
}

describe('Classic game definitions', () => {
  beforeEach(() => records.clear())

  it('stores the immutable board separately from player progress', async () => {
    const definition = classicDefinition()
    await saveClassicGameDefinition(definition)
    await saveGameSelection('c001', definition.seed, {
      elapsedSeconds: 12,
      gameGridScreenshot: null,
      isCompleted: false,
      lockedCellGroups: [],
      markers: [],
      moveCount: 4,
      savedAt: 123,
      selectedCellKeys: ['1,1'],
    })

    await expect(loadClassicGameDefinition('c001', definition.seed)).resolves.toEqual(definition)
    expect(records.get(`definition:c001:${definition.seed}`)?.state).toEqual(definition)
    expect(records.get(`selection:c001:${definition.seed}`)?.state).not.toHaveProperty('pieces')
  })

  it('does not create a definition while reading a legacy progress-only save', async () => {
    await saveGameSelection('c001', 'legacy-seed', {
      elapsedSeconds: 12,
      gameGridScreenshot: null,
      isCompleted: false,
      lockedCellGroups: [],
      markers: [],
      moveCount: 4,
      savedAt: 123,
      selectedCellKeys: ['1,1'],
    })
    const recordCount = records.size

    await expect(loadClassicGameDefinition('c001', 'legacy-seed')).resolves.toBeNull()
    expect(records.size).toBe(recordCount)
  })

  it('keeps Career progress out of the general saved-game list', async () => {
    await saveGameSelection('c001', 'career:authored-level', {
      elapsedSeconds: 12,
      gameGridScreenshot: new Blob(['board'], { type: 'image/png' }),
      isCompleted: false,
      lockedCellGroups: [],
      markers: [],
      moveCount: 4,
      savedAt: 123,
      selectedCellKeys: [],
    })

    await expect(loadSavedGames()).resolves.toEqual([])
  })
})

describe('Local VS persistence', () => {
  beforeEach(() => records.clear())

  it('round-trips the complete local game state', async () => {
    const state: VsLocalGameSaveState = {
      ...createVsLocalGame(() => 1, { combinationWinCount: 3 }),
      activePlayer: 1,
      lockedShapes: [{ id: 'lock:1', player: 0, cellKeys: ['0,0', '1,0', '0,1', '1,1'] }],
      nextMoveConstraint: { direction: 'diagonal', originColumn: 4, originRow: 5 },
      pendingMoveDirection: 'orthogonal',
      pendingPlacement: { column: 5, row: 6, corner: 2 },
      placedCells: [
        { column: 0, row: 0, corner: 0, player: 0, lockedBy: 0 },
        { column: 5, row: 6, corner: 2, player: 1 },
      ],
    }
    state.history = { positions: [getVsHistoryPosition(state)], index: 0 }

    await saveVsLocalGameState(state)
    await expect(loadVsLocalGameState()).resolves.toEqual(state)
  })

  it('round-trips a manually selected shared-cell combination and its winning history', async () => {
    const game = createVsLocalGame(() => 0)
    for (const direction of [-1, 1]) {
      for (const corner of [1, 2, 3] as const) {
        game.placedCells.push({ column: 4 + direction * corner, row: 4, corner, player: 1 })
      }
    }
    game.pendingPlacement = { column: 4, row: 4, corner: 0 }
    game.selectedCellKeys = ['1,4', '2,4', '3,4', '5,4', '6,4', '7,4']
    game.history = { positions: [getVsHistoryPosition(game)], index: 0 }
    await saveVsLocalGameState(structuredClone(game))
    const restored = await loadVsLocalGameState()
    expect(restored).toEqual(game)

    const finished = finishVsTurn(restored!)
    expect(finished.result).toEqual({ reason: 'combination', winner: 0, shapeCount: 2 })
    expect(finished.lockedShapes).toHaveLength(2)
    await saveVsLocalGameState(finished)
    await expect(loadVsLocalGameState()).resolves.toEqual(finished)
    expect(goToVsHistory(goToVsHistory(finished, 0), 1)).toEqual(finished)
  })

  it('does not restore malformed saved data', async () => {
    await (await db).put('games', { id: 'vs:local:current', state: { activePlayer: 3 }, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it('rejects incomplete save schemas', async () => {
    await (await db).put('games', {
      id: 'vs:local:current',
      updatedAt: Date.now(),
      state: {
        activePlayer: 0,
        lockedShapes: [],
        pendingPlacement: null,
        placedCells: [],
      },
    })

    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it('clears the current Local VS match before a new game', async () => {
    await saveVsLocalGameState(createVsLocalGame())
    await clearVsLocalGameState()
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it('restores the configured threshold and victory without allowing another turn', async () => {
    const finished = finishedVsGame()
    await saveVsLocalGameState(finished)
    const restored = await loadVsLocalGameState()
    expect(restored).toEqual(finished)
    expect(restored?.result).toEqual({ reason: 'combination', winner: 1, shapeCount: 3 })
    expect(selectVsCell(restored!, 4, 9)).toBe(restored)
  })

  it.each([[2, true], [3, true], [2, false], [3, false]] as const)('round-trips %s overlapping captures and their history (overlap victory: %s)', async (shapeCount, allowOverlappingCombinationWin) => {
    let game = createVsLocalGame(() => 0, { combinationWinCount: shapeCount, allowOverlappingCombinationWin })
    const corners = [1, 2, 3, 0, 1, 2] as const
    for (let column = 0; column < shapeCount + 3; column++) {
      if (column === 3) game.pendingPlacement = { column, row: 4, corner: 0 }
      else game.placedCells.push({ column, row: 4, corner: corners[column], player: 1 })
    }
    game.history = { positions: [getVsHistoryPosition(game)], index: 0 }
    await saveVsLocalGameState(structuredClone(game))
    game = (await loadVsLocalGameState())!
    expect(game.allowOverlappingCombinationWin).toBe(allowOverlappingCombinationWin)
    const finished = finishVsTurn(game)
    expect(finished.lockedShapes).toHaveLength(shapeCount)
    expect(finished.result).toEqual(allowOverlappingCombinationWin ? { reason: 'combination', winner: 0, shapeCount } : null)
    await saveVsLocalGameState(finished)
    await expect(loadVsLocalGameState()).resolves.toEqual(finished)

    const past = goToVsHistory(finished, 0)
    await saveVsLocalGameState(past)
    const restored = await loadVsLocalGameState()
    expect(restored).toEqual(past)
    expect(goToVsHistory(restored!, 1)).toEqual(finished)
  })



  it.each([
    { allowOverlappingCombinationWin: 'false' },
    { allowOverlappingCombinationWin: 0 },
    { allowOverlappingCombinationWin: null },
    { combinationWinCount: 1 },
    { combinationWinCount: 2.5 },
    { combinationWinCount: Infinity },
    { result: { reason: 'combination', winner: 3, shapeCount: 3 } },
    { result: { reason: 'combination', winner: 0, shapeCount: 3 } },
    { result: { reason: 'combination', winner: 1, shapeCount: 2 } },
    { result: { reason: 'combination', winner: 1, shapeCount: 3.5 } },
    { result: { reason: 'unknown', winner: 1, shapeCount: 3 } },
    { pendingPlacement: { column: 4, row: 9, corner: 0 } },
  ])('rejects malformed victory data: %j', async (overrides) => {
    await (await db).put('games', { id: 'vs:local:current', state: { ...finishedVsGame(), ...overrides }, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })


  it('resumes an ongoing three-turn streak and persists the resulting victory', async () => {
    let game = createVsLocalGame(() => 0, { consecutiveTurnWinCount: 3 })
    for (const row of [1, 4, 7]) {
      for (const corner of [1, 2, 3] as const) {
        game.placedCells.push({ column: corner, row, corner, player: 1 })
      }
    }
    game = finishVsTurn({ ...game, pendingPlacement: { column: 4, row: 1, corner: 0 } })
    game = finishVsTurn(selectVsCell(game, 4, 2))
    game = finishVsTurn({ ...game, pendingPlacement: { column: 4, row: 4, corner: 0 } })
    game = finishVsTurn(selectVsCell(game, 4, 5))
    await saveVsLocalGameState(game)

    const restored = await loadVsLocalGameState()
    expect(restored).toEqual(game)
    expect(restored?.consecutiveTurnWinCount).toBe(3)
    expect(restored?.captureStreak).toEqual({ player: 0, turnCount: 2 })
    expect(restored?.result).toBeNull()
    const finished = finishVsTurn({ ...restored!, pendingPlacement: { column: 4, row: 7, corner: 0 } })
    expect(finished.result).toEqual({ reason: 'consecutive-turns', winner: 0, turnCount: 3 })

    await saveVsLocalGameState(finished)
    const savedVictory = await loadVsLocalGameState()
    expect(savedVictory).toEqual(finished)
    expect(selectVsCell(savedVictory!, 4, 9)).toBe(savedVictory)
  })

  it.each([
    { consecutiveTurnWinCount: 1 },
    { consecutiveTurnWinCount: 2.5 },
    { consecutiveTurnWinCount: Infinity },
    { captureStreak: { player: 3, turnCount: 1 } },
    { captureStreak: { player: 0, turnCount: 0 } },
    { captureStreak: { player: 0, turnCount: 1.5 } },
    { captureStreak: { player: 0, turnCount: Infinity } },
    { captureStreak: { player: 0, turnCount: 2 } },
  ])('rejects invalid ongoing streak data: %j', async (overrides) => {
    await (await db).put('games', { id: 'vs:local:current', state: { ...createVsLocalGame(), ...overrides }, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it.each([
    { consecutiveTurnWinCount: 3 },
    { captureStreak: null },
    { captureStreak: { player: 0, turnCount: 2 } },
    { captureStreak: { player: 1, turnCount: 3 } },
    { result: { reason: 'consecutive-turns', winner: 1, turnCount: 1 } },
    { result: { reason: 'consecutive-turns', winner: 1, turnCount: 2.5 } },
  ])('rejects inconsistent consecutive-turn victories: %j', async (overrides) => {
    const state = {
      ...finishedVsGame(),
      captureStreak: { player: 1, turnCount: 2 },
      result: { reason: 'consecutive-turns', winner: 1, turnCount: 2 },
      ...overrides,
    }
    await (await db).put('games', { id: 'vs:local:current', state, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it.each([
    ['points', true, 0, { reason: 'trap', winner: 0 }],
    ['points', true, 1, { reason: 'trap', winner: null }],
    ['points', true, 2, { reason: 'trap', winner: 1 }],
    ['draw', true, 0, { reason: 'trap', winner: null }],
    ['points', false, 2, { reason: 'no-legal-moves', winner: null }],
  ] as const)('restores a finished trap: mode %s, capture %s, opponent shapes %s', async (trapResolution, capture, opponentShapes, result) => {
    const finished = trappedVsGame(trapResolution, capture, opponentShapes)
    expect(finished.result).toEqual(result)
    await saveVsLocalGameState(finished)
    const restored = await loadVsLocalGameState()
    expect(restored).toEqual(finished)
    expect(restored?.trapResolution).toBe(trapResolution)
    expect(selectVsCell(restored!, 4, 8)).toBe(restored)
  })

  it('preserves the selected trap rule before the match ends', async () => {
    const game = createVsLocalGame(() => 0, { trapResolution: 'draw' })
    await saveVsLocalGameState(game)
    await expect(loadVsLocalGameState()).resolves.toEqual(game)
  })


  it('restores the full future, current history position, and draft after a reload', async () => {
    const latest = finishedVsGame()
    const earlier = goToVsHistory(latest, 0)
    const draft = toggleVsMoveDirection(selectVsCell(earlier, 9, 9))
    // Exercise a real serialization boundary rather than sharing references with the mock DB.
    await saveVsLocalGameState(structuredClone(draft))
    const restored = await loadVsLocalGameState()
    expect(restored).toEqual(draft)
    expect(goToVsHistory(restored!, latest.history.index)).toEqual(latest)

    const branch = finishVsTurn(restored!)
    expect(branch.result).toBeNull()
    expect(branch.history.positions.at(-1)?.result).toBeNull()
    await saveVsLocalGameState(branch)
    expect(await loadVsLocalGameState()).toEqual(branch)
  })

  it('keeps restored historical positions view-only with rewriting disabled', async () => {
    let latest = createVsLocalGame(() => 0, { allowHistoryRewrite: false })
    latest = finishVsTurn(selectVsCell(latest, 4, 4))
    latest = finishVsTurn(selectVsCell(latest, 4, 5))
    const past = goToVsHistory(latest, 1)
    await saveVsLocalGameState(past)
    const restored = await loadVsLocalGameState()
    expect(restored).toEqual(past)
    expect(canPlayVsTurn(restored!)).toBe(false)
    expect(selectVsCell(restored!, 4, 6)).toBe(restored)
    expect(canPlayVsTurn(goToVsHistory(restored!, 2))).toBe(true)
  })



  it.each([
    { allowHistoryRewrite: 'yes' },
    { history: null },
    { history: { positions: [], index: 0 } },
    { history: { positions: [null], index: 0 } },
    { history: { positions: [{}], index: 0 } },
    { history: { positions: [getVsHistoryPosition(createVsLocalGame(() => 0))], index: -1 } },
    { history: { positions: [getVsHistoryPosition(createVsLocalGame(() => 0))], index: 1 } },
    { history: { positions: [getVsHistoryPosition(createVsLocalGame(() => 0))], index: 0.5 } },
    { history: { positions: [{ ...getVsHistoryPosition(createVsLocalGame(() => 0)), activePlayer: 3 }], index: 0 } },
  ])('rejects malformed history or rewriting configuration: %j', async (overrides) => {
    await (await db).put('games', { id: 'vs:local:current', state: { ...createVsLocalGame(() => 0), ...overrides }, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it('rejects a save whose displayed board disagrees with its history cursor', async () => {
    const game = finishVsTurn(selectVsCell(createVsLocalGame(() => 0), 4, 4))
    await saveVsLocalGameState({ ...game, history: { ...game.history, index: 0 } })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it('rejects corrupted future positions even when the displayed position is valid', async () => {
    const game = finishVsTurn(selectVsCell(createVsLocalGame(() => 0), 4, 4))
    const past = goToVsHistory(game, 0)
    const future = game.history.positions[1]
    await saveVsLocalGameState({
      ...past,
      history: { index: 0, positions: [past.history.positions[0], { ...future, placedCells: [] }] },
    })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
    await saveVsLocalGameState({
      ...past,
      history: { index: 0, positions: [past.history.positions[0], { ...future, result: { reason: 'trap', winner: 0 } }] },
    })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it('rejects drafts in view-only historical positions', async () => {
    const latest = finishVsTurn(selectVsCell(createVsLocalGame(() => 0, { allowHistoryRewrite: false }), 4, 4))
    await saveVsLocalGameState({ ...goToVsHistory(latest, 0), pendingPlacement: { column: 5, row: 5, corner: 1 } })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it.each([
    { trapResolution: 'unknown' },
    { trapResolution: false },
    { trapResolution: 'draw' },
    { result: { reason: 'trap', winner: 1 } },
    { result: { reason: 'trap', winner: 3 } },
    { result: { reason: 'trap', winner: null } },
    { result: { reason: 'no-legal-moves', winner: 0 } },
    { result: { reason: 'no-legal-moves', winner: null } },
    { captureStreak: null },
    { nextMoveConstraint: null },
    { nextMoveConstraint: { direction: 'orthogonal', originColumn: 0, originRow: 0 } },
    { pendingPlacement: { column: 4, row: 8, corner: 0 } },
  ])('rejects malformed or inconsistent trap saves: %j', async (overrides) => {
    const state = { ...trappedVsGame('points'), ...overrides }
    await (await db).put('games', { id: 'vs:local:current', state, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })
})
