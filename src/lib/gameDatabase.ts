import { openDB, type IDBPDatabase } from 'idb'
import type { SavedSandboxWorld, StoredGame } from './db'
import { migrateLegacyClassicSaveRecords, migrateLegacyGameState } from './saveMigration'

const DATABASE_NAME = 'nokomino'
// Compatibility identifiers are intentionally retained for existing installations.
const LEGACY_DATABASE_NAME = 'corneromino'
const LEGACY_IMPORT_KEY = 'legacy-data-import-v1'

interface GameStores {
  games: { key: string; value: StoredGame }
  sandboxWorlds: { key: string; value: SavedSandboxWorld }
}

interface NokominoDatabase extends GameStores {
  migrations: { key: string; value: number }
}

async function readLegacyData(): Promise<{ games: StoredGame[]; worlds: SavedSandboxWorld[] }> {
  let missing = false
  let legacy: IDBPDatabase<GameStores>
  try {
    // Omit the version to read any historical schema without upgrading it or
    // waiting for older open tabs to close. Abort creation on a fresh install.
    legacy = await openDB<GameStores>(LEGACY_DATABASE_NAME, undefined, {
      upgrade(_database, oldVersion, _newVersion, transaction) {
        if (oldVersion === 0) {
          missing = true
          void transaction.done.catch(() => undefined)
          transaction.abort()
        }
      },
    })
  } catch (error) {
    if (missing && error instanceof DOMException && error.name === 'AbortError') return { games: [], worlds: [] }
    throw error
  }

  try {
    const stores = (['games', 'sandboxWorlds'] as const).filter((name) => legacy.objectStoreNames.contains(name))
    if (stores.length === 0) return { games: [], worlds: [] }
    const transaction = legacy.transaction(stores, 'readonly')
    const [games, worlds] = await Promise.all([
      stores.includes('games') ? transaction.objectStore('games').getAll() : Promise.resolve([]),
      stores.includes('sandboxWorlds') ? transaction.objectStore('sandboxWorlds').getAll() : Promise.resolve([]),
      transaction.done,
    ])
    return { games, worlds }
  } finally {
    legacy.close()
  }
}

async function importLegacyData(database: IDBPDatabase<NokominoDatabase>) {
  if (await database.get('migrations', LEGACY_IMPORT_KEY) !== undefined) return
  const { games, worlds } = await readLegacyData()
  const normalized = new Map(games.map((record) => [record.id, record]))
  const migration = migrateLegacyClassicSaveRecords(games)
  for (const id of migration.deleteIds) normalized.delete(id)
  for (const record of migration.putRecords) normalized.set(record.id, record)

  // The data and completion marker commit together. A failed import is retried
  // next launch; a successful one cannot resurrect subsequently deleted saves.
  const transaction = database.transaction(['games', 'sandboxWorlds', 'migrations'], 'readwrite')
  try {
    const markers = transaction.objectStore('migrations')
    // Serialize simultaneous first launches in separate tabs.
    if (await markers.get(LEGACY_IMPORT_KEY) !== undefined) {
      await transaction.done
      return
    }
    const targetGames = transaction.objectStore('games')
    for (const record of normalized.values()) {
      const existing = await targetGames.get(record.id)
      if (record.id === 'cascade:best-score' && typeof existing?.state === 'number' && typeof record.state === 'number') {
        if (existing.state >= record.state) continue
      } else if (existing && existing.updatedAt >= record.updatedAt) continue
      await targetGames.put({ ...record, state: migrateLegacyGameState(record.id, record.state) })
    }
    const targetWorlds = transaction.objectStore('sandboxWorlds')
    for (const world of worlds) {
      const existing = await targetWorlds.get(world.id)
      if (!existing || existing.savedAt < world.savedAt) await targetWorlds.put(world)
    }
    await markers.put(Date.now(), LEGACY_IMPORT_KEY)
    await transaction.done
  } catch (error) {
    try { transaction.abort() } catch { /* Already aborted by IndexedDB. */ }
    await transaction.done.catch(() => undefined)
    throw error
  }
}

/** Resolves only after every old save has been imported, before any app reads/writes. */
export async function openGameDatabase(): Promise<IDBPDatabase<NokominoDatabase>> {
  const database = await openDB<NokominoDatabase>(DATABASE_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('games', { keyPath: 'id' })
      database.createObjectStore('sandboxWorlds', { keyPath: 'id' })
      database.createObjectStore('migrations')
    },
  })
  try {
    await importLegacyData(database)
    return database
  } catch (error) {
    database.close()
    throw error
  }
}
