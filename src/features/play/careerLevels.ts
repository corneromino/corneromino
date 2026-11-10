import type { ClassicGameDefinition } from '@/lib/db'
import type { CareerTutorial } from './careerTutorial'
import { level1 } from '@/assets/levels/1'
import { level2 } from '@/assets/levels/2'
import { level3 } from '@/assets/levels/3'
import { level4 } from '@/assets/levels/4'
import { level5 } from '@/assets/levels/5'
import { level6 } from '@/assets/levels/6'
import { level7 } from '@/assets/levels/7'
import { level8 } from '@/assets/levels/8'
import { level9 } from '@/assets/levels/9'
import { level10 } from '@/assets/levels/10'
import { level11 } from '@/assets/levels/11'
import { level12 } from '@/assets/levels/12'
import { level13 } from '@/assets/levels/13'
import { level14 } from '@/assets/levels/14'
import { level15 } from '@/assets/levels/15'
import { level16 } from '@/assets/levels/16'
import { level17 } from '@/assets/levels/17'
import { level18 } from '@/assets/levels/18'

export type CareerLevelEdge = 'top' | 'bottom' | 'left' | 'right'
export type CareerLevelOrigin = 'absolute' | 'relative'

/** A Career map position, which may be shown before it has an authored board. */
export interface CareerLevel {
  /** Optional face color for the level card. */
  bgColor?: string
  data?: ClassicGameDefinition
  /** Outgoing edge on this card, connecting it to the following level. */
  from?: CareerLevelEdge
  /** Coordinates are absolute map positions by default, or offsets from the prior level. */
  origin?: CareerLevelOrigin
  /** Edge on the following card where this card's connection arrives. */
  to?: CareerLevelEdge
  /** Optional guided lesson that starts from its first step whenever the level opens. */
  tutorial?: CareerTutorial
  x: number
  y: number
}

interface PlayableCareerLevel extends CareerLevel {
  data: ClassicGameDefinition
}

export interface ResolvedCareerLevel extends PlayableCareerLevel {
  index: number
  number: number
}

/** Career levels are played in this list order. */
export const careerLevels: CareerLevel[] = [
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  level9,
  level10,
  level11,
  level12,
  level13,
  level14,
  level15,
  level16,
  level17,
  level18,
]

export interface CareerLevelPosition {
  level: CareerLevel
  x: number
  y: number
}

/** Resolves relative authored offsets into absolute map coordinates. */
export function resolveCareerLevelPositions(levels: readonly CareerLevel[] = careerLevels): CareerLevelPosition[] {
  let previous = { x: 0, y: 0 }
  return levels.map((level) => {
    const position = level.origin === 'relative'
      ? { x: previous.x + level.x, y: previous.y + level.y }
      : { x: level.x, y: level.y }
    previous = position
    return { level, ...position }
  })
}

/** Returns the map index of the current playable Career level. */
export function getCurrentCareerLevelIndex(progression: readonly { completed: boolean; seed: string }[], levels: readonly CareerLevel[] = careerLevels): number {
  let priorLevelCompleted = true
  let currentLevelIndex = 0
  for (const [index, level] of levels.entries()) {
    const seed = level.data?.seed
    if (!seed) continue
    if (!priorLevelCompleted) break
    currentLevelIndex = index
    priorLevelCompleted = progression.some((levelProgression) => levelProgression.seed === seed && levelProgression.completed)
  }
  return currentLevelIndex
}

function resolveCareerLevel(level: PlayableCareerLevel, index: number): ResolvedCareerLevel {
  return { ...level, index, number: index + 1 }
}

export function getCareerLevel(seed: string): ResolvedCareerLevel | null {
  const index = careerLevels.findIndex((level) => level.data?.seed === seed)
  const level = careerLevels[index]
  return level?.data ? resolveCareerLevel(level as PlayableCareerLevel, index) : null
}

export function getNextCareerLevel(level: ResolvedCareerLevel): ResolvedCareerLevel | null {
  for (let index = level.index + 1; index < careerLevels.length; index += 1) {
    const next = careerLevels[index]
    if (next?.data) return resolveCareerLevel(next as PlayableCareerLevel, index)
  }
  return null
}

/** Progress is independent from a level's order or future map position. */
export function getCareerGameId(definition: ClassicGameDefinition) {
  return `career:${definition.seed}`
}

export function getCareerLevelPath(level: PlayableCareerLevel) {
  return `/play?${new URLSearchParams({ career: level.data.seed }).toString()}`
}
