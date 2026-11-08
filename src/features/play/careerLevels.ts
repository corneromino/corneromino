import type { ClassicGameDefinition } from '@/lib/db'

export type CareerLevelEdge = 'top' | 'bottom' | 'left' | 'right'

/** A Career map position, which may be shown before it has an authored board. */
export interface CareerLevel {
  data?: ClassicGameDefinition
  /** Outgoing edge on this card, connecting it to the following level. */
  from?: CareerLevelEdge
  /** Edge on the following card where this card's connection arrives. */
  to?: CareerLevelEdge
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
  {
    data: {
      config: {
        columns: 5,
        rows: 5,
        spread: 0,
        tetrominoCount: 1,
        lockingMode: 'auto',
        finalVerificationMode: 'auto',
        completionScreenshotDelayMs: 400,
        finalLockAnimationEnabled: true,
        hideGameControls: false,
        navigationEnabled: true,
      },
      gameMode: 'c003',
      pieces: [{
        cells: [
          { cellId: 'a', corner: 'top-right', x: 2, y: 2 },
          { cellId: 'b', corner: 'top-left', x: 3, y: 1 },
          { cellId: 'c', corner: 'bottom-right', x: 2, y: 1 },
          { cellId: 'd', corner: 'bottom-left', x: 1, y: 1 },
        ],
        id: 1,
        kind: 'T',
      }],
      version: 1,
      customName: '',
      seed: 'custom-611cfe2e-805e-47fa-b5b1-6a67fe18c2b8',
      source: 'custom',
    },
    x: 0,
    y: 0,
    from: 'top',
    to: 'bottom'
  }, {
    x: 0,
    y: 200,
    from: 'top',
    to: 'right'
  }, {
    x: -0.7,
    y: 300,
    from: 'top',
    to: 'bottom'
  },
]

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
