import { beforeEach, describe, expect, it, vi } from 'vitest'

const records = vi.hoisted(() => new Map<string, { id: string; state: unknown; updatedAt: number }>())

vi.mock('idb', () => ({
  openDB: async () => ({
    get: async (_store: string, key: string) => records.get(key),
    put: async (_store: string, value: { id: string; state: unknown; updatedAt: number }) => { records.set(value.id, value) },
    delete: async (_store: string, key: string) => { records.delete(key) },
  }),
}))

import { clearVsLocalGameState, db, loadVsLocalGameState, saveVsLocalGameState, type VsLocalGameSaveState } from './db'
import { createVsLocalGame, finishVsTurn, selectVsCell } from '@/features/vs/vsLocalGame'
import { VS_LOCAL_CONFIG, type VsTrapResolution } from '@/features/vs/vsLocalConfig'

function finishedVsGame() {
  const game = createVsLocalGame(() => 1, { combinationWinCount: 3 })
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) {
    for (const corner of [1, 2, 3] as const) {
      game.placedCornerominoes.push({ column: 4 + dx * corner, row: 4 + dy * corner, corner, player: 0 })
    }
  }
  return finishVsTurn({ ...game, pendingPlacement: { column: 4, row: 4, corner: 0 } })
}

function trappedVsGame(trapResolution: VsTrapResolution, capture = true, opponentShapes = 0) {
  const game = createVsLocalGame(() => 0, { trapResolution })
  game.pendingPlacement = { column: 0, row: 0, corner: 0 }
  game.pendingMoveDirection = 'diagonal'
  for (let index = 1; index < 10; index += 1) {
    game.placedCornerominoes.push({ column: index, row: index, corner: capture && index === 1 ? 1 : capture && index === 2 ? 2 : 3, player: 1 })
  }
  for (let index = 0; index < opponentShapes; index += 1) {
    const row = 1 + index * 3
    const cells = [[6, row, 0], [7, row, 1], [6, row + 1, 2], [7, row + 1, 3]] as const
    game.lockedCornerominoes.push({ id: `old:${index}`, player: 1, cellKeys: cells.map(([x, y]) => `${x},${y}`) })
    for (const [column, row, corner] of cells) game.placedCornerominoes.push({ column, row, corner, player: 0, lockedBy: 1 })
  }
  return finishVsTurn(game)
}

describe('Local VS persistence', () => {
  beforeEach(() => records.clear())

  it('round-trips the complete local game state', async () => {
    const state: VsLocalGameSaveState = {
      ...createVsLocalGame(() => 1, { combinationWinCount: 3 }),
      activePlayer: 1,
      lockedCornerominoes: [{ id: 'lock:1', player: 0, cellKeys: ['0,0', '1,0', '0,1', '1,1'] }],
      nextMoveConstraint: { direction: 'diagonal', originColumn: 4, originRow: 5 },
      pendingMoveDirection: 'orthogonal',
      pendingPlacement: { column: 5, row: 6, corner: 2 },
      placedCornerominoes: [
        { column: 0, row: 0, corner: 0, player: 0, lockedBy: 0 },
        { column: 5, row: 6, corner: 2, player: 1 },
      ],
    }

    await saveVsLocalGameState(state)
    await expect(loadVsLocalGameState()).resolves.toEqual(state)
  })

  it('does not restore malformed saved data', async () => {
    await (await db).put('games', { id: 'vs:local:current', state: { activePlayer: 3 }, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })

  it('restores Local VS saves created before move directions were added', async () => {
    await (await db).put('games', {
      id: 'vs:local:current',
      updatedAt: Date.now(),
      state: {
        activePlayer: 0,
        lockedCornerominoes: [],
        pendingPlacement: null,
        placedCornerominoes: [],
      },
    })

    await expect(loadVsLocalGameState()).resolves.toMatchObject({
      captureStreak: null,
      combinationWinCount: VS_LOCAL_CONFIG.combinationWinCount,
      consecutiveTurnWinCount: VS_LOCAL_CONFIG.consecutiveTurnWinCount,
      nextMoveConstraint: null,
      pendingMoveDirection: 'orthogonal',
      result: null,
      trapResolution: VS_LOCAL_CONFIG.trapResolution,
    })
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

  it('does not infer a victory from historical locks in a save predating victory rules', async () => {
    const { combinationWinCount: _threshold, consecutiveTurnWinCount: _turnThreshold, captureStreak: _streak, result: _result, ...legacy } = finishedVsGame()
    await (await db).put('games', { id: 'vs:local:current', state: legacy, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toEqual({
      ...legacy,
      captureStreak: null,
      combinationWinCount: VS_LOCAL_CONFIG.combinationWinCount,
      consecutiveTurnWinCount: VS_LOCAL_CONFIG.consecutiveTurnWinCount,
      result: null,
    })
  })

  it.each([
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

  it('preserves earlier combination victories while initializing the new streak fields', async () => {
    const { consecutiveTurnWinCount: _threshold, captureStreak: _streak, ...legacy } = finishedVsGame()
    await (await db).put('games', { id: 'vs:local:current', state: legacy, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toEqual({
      ...legacy,
      captureStreak: null,
      consecutiveTurnWinCount: VS_LOCAL_CONFIG.consecutiveTurnWinCount,
    })
  })

  it('resumes an ongoing three-turn streak and persists the resulting victory', async () => {
    let game = createVsLocalGame(() => 0, { consecutiveTurnWinCount: 3 })
    for (const row of [1, 4, 7]) {
      for (const corner of [1, 2, 3] as const) {
        game.placedCornerominoes.push({ column: corner, row, corner, player: 1 })
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

  it('adds the default trap rule to older saves without changing their result', async () => {
    const { trapResolution: _rule, ...legacy } = finishedVsGame()
    await (await db).put('games', { id: 'vs:local:current', state: legacy, updatedAt: Date.now() })
    await expect(loadVsLocalGameState()).resolves.toEqual({ ...legacy, trapResolution: VS_LOCAL_CONFIG.trapResolution })
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
