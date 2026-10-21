/** Creates a deterministic pseudo-random number generator for a seed value. */
export function createSeededRandom(seed: string): () => number {
  let state = 1779033703 ^ seed.length

  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 3432918353)
    state = (state << 13) | (state >>> 19)
  }

  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507)
    state = Math.imul(state ^ (state >>> 13), 3266489909)
    state ^= state >>> 16
    return (state >>> 0) / 4294967296
  }
}

export function createRandomSeed(): string {
  return crypto.randomUUID()
}
