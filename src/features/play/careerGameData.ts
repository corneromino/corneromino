import type { BonusRequirement } from '@/game/bonus'
import type { ClassicGameDefinition } from '@/lib/db'

/** Export the active Career board in the format accepted by Create mode. */
export function createCareerGameDataForCopy(definition: ClassicGameDefinition, bonus?: readonly BonusRequirement[]): ClassicGameDefinition {
  const { customName, ...data } = definition
  return {
    ...data,
    ...(customName?.trim() ? { customName } : {}),
    ...(bonus !== undefined ? { bonus } : {}),
  }
}
