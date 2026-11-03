import { openDB, type IDBPDatabase } from 'idb'
import type { SavedSandboxWorld, StoredGame } from './db'
import { migrateLegacyClassicSaveRecords, migrateLegacyGameState } from './saveMigration'

const DATABASE_NAME = 'game-data'
// Compatibility identifiers are intentionally retained for existing installations.
const LEGACY_DATABASE_NAME = 'corneromino'
const PREVIOUS_DATABASE_NAME = 'nokomino'
const LEGACY_IMPORT_KEY = 'legacy-data-import-v1'

interface GameStores {
  games: { key: string; value: StoredGame }
  sandboxWorlds: { key: string; value: SavedSandboxWorld }
}

interface GameDatabase extends GameStores {
  migrations: { key: string; value: number }
}

async function readDatabaseData(name: string): Promise<{ games: StoredGame[]; worlds: SavedSandboxWorld[]; importedLegacy?: boolean }> {
  let missing = false
  let legacy: IDBPDatabase<GameDatabase>
  try {
    // Omit the version to read any historical schema without upgrading it or
    // waiting for older open tabs to close. Abort creation on a fresh install.
    legacy = await openDB<GameDatabase>(name, undefined, {
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
    const stores = (['games', 'sandboxWorlds', 'migrations'] as const).filter((name) => legacy.objectStoreNames.contains(name))
    if (stores.length === 0) return { games: [], worlds: [] }
    const transaction = legacy.transaction(stores, 'readonly')
    const [games, worlds, importedLegacy] = await Promise.all([
      stores.includes('games') ? transaction.objectStore('games').getAll() : Promise.resolve([]),
      stores.includes('sandboxWorlds') ? transaction.objectStore('sandboxWorlds').getAll() : Promise.resolve([]),
      stores.includes('migrations') ? transaction.objectStore('migrations').get(LEGACY_IMPORT_KEY) : Promise.resolve(undefined),
      transaction.done,
    ])
    return { games, worlds, importedLegacy: importedLegacy !== undefined }
  } finally {
    legacy.close()
  }
}

async function importLegacyData(database: IDBPDatabase<GameDatabase>) {
  if (await database.get('migrations', LEGACY_IMPORT_KEY) !== undefined) return
  const previous = await readDatabaseData(PREVIOUS_DATABASE_NAME)
  // A completed previous import makes that database authoritative, including
  // deletions. Never resurrect records from its retained older backup.
  const legacy = previous.importedLegacy ? { games: [], worlds: [] } : await readDatabaseData(LEGACY_DATABASE_NAME)
  const gamesById = new Map<string, StoredGame>()
  for (const record of [...legacy.games, ...previous.games]) {
    const existing = gamesById.get(record.id)
    if (!existing || record.updatedAt >= existing.updatedAt
      || (record.id === 'cascade:best-score' && typeof record.state === 'number' && typeof existing.state === 'number' && record.state > existing.state)) {
      if (record.id === 'cascade:best-score' && typeof record.state === 'number' && typeof existing?.state === 'number' && record.state < existing.state) continue
      gamesById.set(record.id, record)
    }
  }
  const games = [...gamesById.values()]
  const worlds = [...legacy.worlds, ...previous.worlds]
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
export async function openGameDatabase(): Promise<IDBPDatabase<GameDatabase>> {
  const database = await openDB<GameDatabase>(DATABASE_NAME, 1, {
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
