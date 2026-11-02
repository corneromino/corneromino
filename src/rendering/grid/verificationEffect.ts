export interface VerificationResult {
  id: number
  isCorrect: boolean
}

export interface VerificationRequest extends VerificationResult {
  /** Occupied cells outside a correct locked group; empty cells are correct. */
  incorrectCellKeys: ReadonlySet<string>
}

export const VERIFICATION_COLORS = { correct: 0x5fc47a, incorrect: 0xe4555c }
