import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB, type IDBPDatabase } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVsLocalGame, finishVsTurn, getVsHistoryPosition, goToVsHistory, type VsLocalPosition } from '@/features/vs/vsLocalGame'
import { openGameDatabase } from './gameDatabase'
import type { CascadeGameSaveState, SavedSandboxWorld, StoredGame } from './db'

const connections: Array<{ close(): void }> = []
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.resetModules()
})
afterEach(() => {
  connections.splice(0).forEach((connection) => connection.close())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function legacyDatabase(version = 3) {
  const database = await openDB('corneromino', version, {
    upgrade(database) {
      database.createObjectStore('games', { keyPath: 'id' })
      if (version >= 2) database.createObjectStore('sandboxWorlds', { keyPath: 'id' })
    },
  })
  connections.push(database)
  return database
}

async function targetDatabase() {
  const database = await openGameDatabase()
  connections.push(database)
  return database
}

async function seedGames(database: IDBPDatabase, records: StoredGame[]) {
  const transaction = database.transaction('games', 'readwrite')
  for (const record of records) await transaction.store.put(record)
  await transaction.done
}

function legacyPosition(position: VsLocalPosition) {
  const { placedNokominos, lockedNokominos, ...rest } = position
  return { ...rest, placedCornerominoes: placedNokominos, lockedCornerominoes: lockedNokominos }
}

describe('Nokomino startup database migration', () => {
  it('imports all modes, VS history and screenshots before the storage API becomes available', async () => {
    const legacy = await legacyDatabase()
    const screenshot = new Blob(['original image bytes'], { type: 'image/png' })
    const selection = {
      selectedCellKeys: ['0,0'], markers: [{ cellKey: '0,0', color: 'black' }],
      lockedCellGroups: [], elapsedSeconds: 31, moveCount: 2, savedAt: 123,
      gameGridScreenshot: screenshot, isCompleted: false,
    }
    const cascade: CascadeGameSaveState = {
      elapsedSinceFall: 52, gameState: { activePiece: { column: 2, row: 3, corner: 0 }, settledPieces: [] },
      lockedPieces: [], lockedNokominoCount: 9, score: 120, selectedPieceKeys: [], destroyedLineCount: 3,
    }
    const { lockedNokominoCount, ...cascadeRest } = cascade
    const baseline = createVsLocalGame(() => 0, { boardSize: 10, allowHistoryRewrite: true })
    baseline.placedNokominos = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([column, row], corner) => ({ column, row, corner: corner as 0 | 1 | 2 | 3, player: 0, lockedBy: 0 }))
    baseline.lockedNokominos = [{ id: 'existing:corneromino:lock', player: 0, cellKeys: ['0,0', '1,0', '0,1', '1,1'] }]
    baseline.history = { index: 0, positions: [getVsHistoryPosition(baseline)] }
    const latest = finishVsTurn({ ...baseline, pendingPlacement: { column: 7, row: 7, corner: 0 } })
    const vs = { ...goToVsHistory(latest, 0), pendingPlacement: { column: 6, row: 6, corner: 1 as const } }
    const legacyVs = { ...legacyPosition(vs), history: { ...vs.history, positions: vs.history.positions.map(legacyPosition) } }
    const world: SavedSandboxWorld = {
      id: 'corneromino:user-world', name: 'My Corneromino world', savedAt: 100, screenshot,
      state: { cornerMarkers: [{ cellKey: '0,0', corner: 2, isOn: true }], gridOffsetX: 12, gridOffsetY: 25, zoom: 2 },
    }
    await seedGames(legacy, [
      ...['c001', 'c002', 'c003', 'c004', 'c005', 'c006'].map((mode) => ({ id: `selection:${mode}:corneromino:seed`, state: selection, updatedAt: 456 })),
      { id: 'cascade:current', state: { ...cascadeRest, lockedCornerominoCount: lockedNokominoCount }, updatedAt: 200 },
      { id: 'cascade:best-score', state: 350, updatedAt: 300 },
      { id: 'vs:local:current', state: legacyVs, updatedAt: 500 },
    ])
    await legacy.put('sandboxWorlds', world)

    const api = await import('./db')
    const database = await api.db
    connections.push(database)
    expect(database.name).toBe('nokomino')
    expect(await database.count('games')).toBe(9)
    expect(await database.count('migrations')).toBe(1)
    const saved = await api.loadSavedGames()
    expect(saved).toHaveLength(6)
    expect(await saved[0].screenshot.text()).toBe('original image bytes')
    expect(await api.loadGameSelection('c003', 'corneromino:seed')).toEqual(selection)
    expect(await api.loadCascadeGameState()).toEqual(cascade)
    expect(await api.loadCascadeBestScore()).toBe(350)
    expect(await api.loadVsLocalGameState()).toEqual(vs)
    expect(await api.loadSandboxWorld(world.id)).toEqual(world)
    const storedVs = await database.get('games', 'vs:local:current')
    expect(storedVs?.updatedAt).toBe(500)
    expect(JSON.stringify(storedVs)).not.toContain('placedCornerominoes')
    expect(JSON.stringify(storedVs)).not.toContain('lockedCornerominoes')
    expect((await legacy.get('games', 'vs:local:current')).state).toEqual(legacyVs)
    expect(legacy.version).toBe(3)
  })

  it('imports version-one saves and resolves legacy difficulty duplicates without changing seeds', async () => {
    const legacy = await legacyDatabase(1)
    await seedGames(legacy, [
      { id: 'selection:easy:seed:with:colons', state: { moveCount: 7 }, updatedAt: 30 },
      { id: 'selection:c003:seed:with:colons', state: { moveCount: 3 }, updatedAt: 20 },
      { id: 'selection:super-easy:second', state: { moveCount: 1 }, updatedAt: 10 },
    ])
    const database = await targetDatabase()
    expect(await database.getAllKeys('games')).toEqual(['selection:c002:second', 'selection:c003:seed:with:colons'])
    expect(await database.get('games', 'selection:c003:seed:with:colons')).toEqual({ id: 'selection:c003:seed:with:colons', state: { moveCount: 7 }, updatedAt: 30 })
    expect(await database.count('sandboxWorlds')).toBe(0)
    expect(legacy.version).toBe(1)
  })

  it('keeps newer destination data when an earlier import was incomplete', async () => {
    const legacy = await legacyDatabase()
    await seedGames(legacy, [
      { id: 'selection:c001:keep', state: { moveCount: 1 }, updatedAt: 10 },
      { id: 'selection:c001:replace', state: { moveCount: 2 }, updatedAt: 30 },
      { id: 'cascade:best-score', state: 400, updatedAt: 10 },
    ])
    const destination = await openDB('nokomino', 1, { upgrade(database) {
      database.createObjectStore('games', { keyPath: 'id' })
      database.createObjectStore('sandboxWorlds', { keyPath: 'id' })
      database.createObjectStore('migrations')
    } })
    connections.push(destination)
    await seedGames(destination, [
      { id: 'selection:c001:keep', state: { moveCount: 3 }, updatedAt: 40 },
      { id: 'selection:c001:replace', state: { moveCount: 1 }, updatedAt: 20 },
      { id: 'cascade:best-score', state: 100, updatedAt: 40 },
    ])
    const database = await targetDatabase()
    expect((await database.get('games', 'selection:c001:keep'))?.state).toEqual({ moveCount: 3 })
    expect((await database.get('games', 'selection:c001:replace'))?.state).toEqual({ moveCount: 2 })
    expect((await database.get('games', 'cascade:best-score'))?.state).toBe(400)
  })

  it('handles simultaneous startup and never resurrects a deleted game on later launches', async () => {
    const legacy = await legacyDatabase()
    const record = { id: 'selection:c001:seed', state: { selectedCellKeys: [] }, updatedAt: 10 }
    await seedGames(legacy, [record])
    const [first, second] = await Promise.all([targetDatabase(), targetDatabase()])
    expect(await first.count('games')).toBe(1)
    expect(await second.count('migrations')).toBe(1)
    await first.delete('games', record.id)
    const reopened = await targetDatabase()
    expect(await reopened.count('games')).toBe(0)
    expect(await legacy.get('games', record.id)).toEqual(record)
  })

  it('rolls back an interrupted import and retries it on the next startup', async () => {
    const legacy = await legacyDatabase()
    await seedGames(legacy, [{ id: 'selection:c001:seed', state: {}, updatedAt: 10 }])
    await legacy.put('sandboxWorlds', { id: 'world', savedAt: 20 })
    const originalPut = IDBObjectStore.prototype.put
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.transaction.db.name === 'nokomino' && this.name === 'sandboxWorlds') throw new DOMException('Full', 'QuotaExceededError')
      return originalPut.call(this, value, key)
    })
    await expect(openGameDatabase()).rejects.toMatchObject({ name: 'QuotaExceededError' })
    const incomplete = await openDB('nokomino')
    connections.push(incomplete)
    expect(await incomplete.count('games')).toBe(0)
    expect(await incomplete.count('migrations')).toBe(0)
    failure.mockRestore()
    const complete = await targetDatabase()
    expect(await complete.count('games')).toBe(1)
    expect(await complete.count('sandboxWorlds')).toBe(1)
    expect(await complete.count('migrations')).toBe(1)
  })

  it('starts cleanly without creating an empty legacy database', async () => {
    const database = await targetDatabase()
    expect(await database.count('games')).toBe(0)
    expect(await database.count('migrations')).toBe(1)
    expect((await indexedDB.databases()).map(({ name }) => name)).toEqual(['nokomino'])
  })
})
