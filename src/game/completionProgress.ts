/** Completion metrics shared by Career and generated Classic games. */
export interface GameCompletionResult {
  bonusPercentage: number
  perfectionPercentage: number
}

/** Rewards finishing a board with fewer unlocks; no unlocks is exactly 100%. */
export function getPerfectionPercentage(cantominoCount: number, unlockCount: number): number {
  if (cantominoCount === 0) return unlockCount === 0 ? 100 : 0
  return cantominoCount / (cantominoCount + unlockCount) * 100
}

/** Retains the strongest result for each independently-earned metric. */
export function mergeCompletionResults(
  currentResult: GameCompletionResult | null,
  nextResult: GameCompletionResult,
): GameCompletionResult {
  return {
    bonusPercentage: Math.max(currentResult?.bonusPercentage ?? 0, nextResult.bonusPercentage),
    perfectionPercentage: Math.max(currentResult?.perfectionPercentage ?? 0, nextResult.perfectionPercentage),
  }
}
