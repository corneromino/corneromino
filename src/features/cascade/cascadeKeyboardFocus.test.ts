import { describe, expect, it } from 'vitest'
import type { CascadePiece } from './cascadeGame'
import { getCascadeKeyboardFocus } from './cascadeKeyboardFocus'

const pieces: CascadePiece[] = [
  { column: 2, row: 3, corner: 0 },
  { column: 0, row: 3, corner: 1 },
  { column: 3, row: 3, corner: 2 },
  { column: 5, row: 3, corner: 3 },
  { column: 2, row: 1, corner: 0 },
  { column: 2, row: 4, corner: 1 },
  { column: 2, row: 6, corner: 2 },
  { column: 3, row: 2, corner: 3 },
]
const locked = new Set(['3,3', '2,4'])

describe('Cascade keyboard focus', () => {
  it.each([
    ['ArrowLeft', { column: 0, row: 3 }],
    ['ArrowRight', { column: 3, row: 2 }],
    ['ArrowUp', { column: 2, row: 1 }],
    ['ArrowDown', { column: 2, row: 6 }],
  ] as const)('moves %s to the nearest eligible piece, skipping locked pieces and empty cells', (direction, target) => {
    expect(getCascadeKeyboardFocus(pieces, locked, { column: 2, row: 3 }, direction)).toMatchObject(target)
  })

  it('keeps focus at an edge when no unlocked piece exists in that direction', () => {
    expect(getCascadeKeyboardFocus(pieces, locked, { column: 5, row: 3 }, 'ArrowRight')).toMatchObject({ column: 5, row: 3 })
    expect(getCascadeKeyboardFocus(pieces, locked, { column: 0, row: 3 }, 'ArrowLeft')).toMatchObject({ column: 0, row: 3 })
  })

  it('moves to another row when the current row has no unlocked neighbor', () => {
    expect(getCascadeKeyboardFocus(pieces, locked, { column: 2, row: 1 }, 'ArrowRight')).toMatchObject({ column: 3, row: 2 })
  })

  it.each([
    ['ArrowLeft', -1, 1],
    ['ArrowRight', 1, 1],
    ['ArrowLeft', -1, 5],
    ['ArrowRight', 1, 5],
  ] as const)('finds the nearest unlocked %s candidate off-row (sign %s, row %s)', (direction, sign, row) => {
    const target = { column: 3 + sign, row, corner: 1 as const }
    const unevenStacks: CascadePiece[] = [
      { column: 3, row: 3, corner: 0 },
      { column: 3 + sign, row: 3, corner: 2 }, // Locked, directly beside focus.
      { column: 3 - sign, row: 3, corner: 2 }, // Opposite direction.
      { column: 3, row: 2, corner: 3 }, // Same column, not left or right.
      { column: 3 + sign * 3, row: 3, corner: 0 }, // Same row, but farther away.
      { column: 3 + sign * 3, row: 0, corner: 0 }, // Farther candidate first.
      target,
    ]
    expect(getCascadeKeyboardFocus(unevenStacks, new Set([`${3 + sign},3`]), { column: 3, row: 3 }, direction)).toEqual(target)
  })

  it('starts at the bottom-left selectable piece and remembers a valid focus', () => {
    expect(getCascadeKeyboardFocus(pieces, locked, null)).toMatchObject({ column: 2, row: 6 })
    expect(getCascadeKeyboardFocus(pieces, locked, { column: 2, row: 3 })).toMatchObject({ column: 2, row: 3 })
  })

  it('recovers to a nearby unlocked piece after the focused piece locks or disappears', () => {
    expect(getCascadeKeyboardFocus(pieces, locked, { column: 3, row: 3 })).toMatchObject({ column: 2, row: 3 })
    expect(getCascadeKeyboardFocus(pieces, locked, { column: 5, row: 4 })).toMatchObject({ column: 5, row: 3 })
  })

  it('handles an empty board or a board with only locked pieces', () => {
    expect(getCascadeKeyboardFocus([], locked, null)).toBeNull()
    expect(getCascadeKeyboardFocus(pieces, new Set(pieces.map((piece) => `${piece.column},${piece.row}`)), { column: 2, row: 3 })).toBeNull()
  })
})
