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

describe('Local VS persistence', () => {
  beforeEach(() => records.clear())

  it('round-trips the complete local game state', async () => {
    const state: VsLocalGameSaveState = {
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
      nextMoveConstraint: null,
      pendingMoveDirection: 'orthogonal',
    })
  })

  it('clears the current Local VS match before a new game', async () => {
    await saveVsLocalGameState({
      activePlayer: 0,
      lockedCornerominoes: [],
      nextMoveConstraint: null,
      pendingMoveDirection: 'orthogonal',
      pendingPlacement: null,
      placedCornerominoes: [],
    })
    await clearVsLocalGameState()
    await expect(loadVsLocalGameState()).resolves.toBeNull()
  })
})
