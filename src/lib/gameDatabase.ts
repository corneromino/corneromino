import { openDB } from 'idb'
import type { SavedSandboxWorld, StoredGame } from './db'

interface GameDatabase {
  games: { key: string; value: StoredGame }
  sandboxWorlds: { key: string; value: SavedSandboxWorld }
}

export function openGameDatabase() {
  return openDB<GameDatabase>('game-data', 1, {
    upgrade(database) {
      database.createObjectStore('games', { keyPath: 'id' })
      database.createObjectStore('sandboxWorlds', { keyPath: 'id' })
    },
  })
}
