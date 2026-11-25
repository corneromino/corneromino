import { describe, expect, it } from 'vitest'
import { getExpandedCanvasOffset } from './gridCanvasAlignment'

describe('expanded canvas entrance alignment', () => {
  it('keeps the same canvas position as the board slides up', () => {
    const final = getExpandedCanvasOffset({ left: 40, top: 150 }, { x: 0, y: 0 })
    expect(final).toEqual({ left: -40, top: -150 })
    expect(getExpandedCanvasOffset({ left: 40, top: 550 }, { x: 0, y: 400 })).toEqual(final)
    expect(getExpandedCanvasOffset({ left: 40, top: 250 }, { x: 0, y: 100 })).toEqual(final)
  })

  it('keeps a tall board inside its canvas while both the page and grid move', () => {
    const expected = getExpandedCanvasOffset({ left: 32, top: 145 }, { x: 0, y: 0 }, { left: 0, top: 0 })
    expect(expected).toEqual({ left: -32, top: -145 })
    // The page is 600px below its destination and the board entrance adds
    // another 400px; neither displacement changes the board's canvas bounds.
    expect(getExpandedCanvasOffset({ left: 32, top: 1145 }, { x: 0, y: 400 }, { left: 0, top: 600 })).toEqual(expected)
    expect(getExpandedCanvasOffset({ left: 32, top: 445 }, { x: 0, y: 100 }, { left: 0, top: 200 })).toEqual(expected)
  })

  it('uses the page origin when the app is inset from the viewport', () => {
    expect(getExpandedCanvasOffset({ left: 52, top: 577 }, { x: 0, y: 400 }, { left: 20, top: 32 }))
      .toEqual({ left: -32, top: -145 })
  })
})
