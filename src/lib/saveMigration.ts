import { LEGACY_GAME_MODE_IDS } from '@/game/gameConfig'
import type { StoredGame } from './db'

interface ClassicSaveMigration {
  deleteIds: string[]
  putRecords: StoredGame[]
}

/** Normalize all legacy difficulty IDs, retaining the newest copy of each save. */
export function migrateLegacyClassicSaveRecords(records: readonly StoredGame[]): ClassicSaveMigration {
  const latestById = new Map(records.map((record) => [record.id, record]))
  const deleteIds: string[] = []
  const putRecords: StoredGame[] = []

  for (const record of records) {
    const [prefix, legacyMode, ...gameIdParts] = record.id.split(':')
    const gameMode = LEGACY_GAME_MODE_IDS[legacyMode as keyof typeof LEGACY_GAME_MODE_IDS]
    if (prefix !== 'selection' || !gameMode || gameIdParts.length === 0) continue

    const targetId = `selection:${gameMode}:${gameIdParts.join(':')}`
    const existing = latestById.get(targetId)
    if (!existing || record.updatedAt > existing.updatedAt) {
      const migrated = { ...record, id: targetId }
      latestById.set(targetId, migrated)
      putRecords.push(migrated)
    }
    deleteIds.push(record.id)
  }

  return { deleteIds, putRecords }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const LEGACY_VS_FIELDS = {
  placedNokominos: 'placedCells',
  lockedNokominos: 'lockedShapes',
  placedCornerominoes: 'placedCells',
  lockedCornerominoes: 'lockedShapes',
} as const
const LEGACY_CASCADE_FIELDS = { lockedNokominoCount: 'lockedShapeCount', lockedCornerominoCount: 'lockedShapeCount' } as const

function renameFields(value: Record<string, unknown>, fields: Record<string, string>): Record<string, unknown> {
  const result = { ...value }
  for (const [legacy, current] of Object.entries(fields)) {
    if (!(legacy in result)) continue
    if (!(current in result)) result[current] = result[legacy]
    delete result[legacy]
  }
  return result
}

/** Only rename schema fields; never rewrite seeds, IDs, user names or binary images. */
export function migrateLegacyGameState(id: string, state: unknown): unknown {
  if (!isRecord(state)) return state
  if (id === 'cascade:current') return renameFields(state, LEGACY_CASCADE_FIELDS)
  if (id !== 'vs:local:current') return state

  const renamed = renameFields(state, LEGACY_VS_FIELDS)
  if (isRecord(renamed.history) && Array.isArray(renamed.history.positions)) {
    renamed.history = {
      ...renamed.history,
      positions: renamed.history.positions.map((position) => isRecord(position) ? renameFields(position, LEGACY_VS_FIELDS) : position),
    }
  }
  return renamed
}
