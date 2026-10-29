import { Container, Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { CASCADE_LOCK_EFFECTS } from '@/features/cascade/cascadeEffects'
import { GridVerificationWave } from './GridVerificationWave'

function setup(columns: number, isCorrect = true, shake = CASCADE_LOCK_EFFECTS.shake) {
  const layers = new Map<string, Container>()
  for (let x = 0; x < columns; x++) {
    // Include both an occupied and an empty cell in every column.
    const occupied = new Container()
    occupied.addChild(new Graphics().rect(0, 0, 10, 10).fill(0xffffff))
    const hidden = new Container()
    hidden.visible = false
    occupied.addChild(hidden)
    layers.set(`${x},0`, occupied)
    layers.set(`${x},1`, new Container())
  }
  const wave = new GridVerificationWave({ id: 1, isCorrect }, columns, shake)
  wave.setCells(layers, 50, 50, 0.04)
  const face = (key: string) => layers.get(key)!.children.at(-1)!
  return { wave, layers, face }
}

describe('verification cell wave', () => {
  it.each([true, false])('covers original artwork with an opaque shaking face, including empty cells (correct: %s)', (isCorrect) => {
    const { wave, layers, face } = setup(8, isCorrect)
    expect(face('0,0').visible).toBe(true)
    expect(face('0,0').alpha).toBe(1)
    expect(face('0,1').visible).toBe(true)
    expect(layers.get('0,0')!.children.slice(0, -1).every(child => !child.visible)).toBe(true)
    expect(face('7,0').visible).toBe(false)
    expect(layers.get('7,0')!.children[0].visible).toBe(true)

    wave.advance(30)
    expect(layers.get('0,0')!.position.x).not.toBe(0)
    expect(layers.get('0,0')!.position.x).toBe(layers.get('0,1')!.position.x)
    expect(layers.get('0,0')!.position.y).toBe(layers.get('0,1')!.position.y)
    wave.hide()
    expect(face('0,0').visible).toBe(false)
    expect(layers.get('0,0')!.children[0].visible).toBe(true)
    expect(layers.get('0,0')!.position.x).toBe(0)
    wave.render()
    expect(face('0,0').visible).toBe(true)
    wave.destroy()
    expect(layers.get('0,0')!.children).toHaveLength(2)
    expect(layers.get('0,0')!.children[0].visible).toBe(true)
    expect(layers.get('0,0')!.children[1].visible).toBe(false)
    expect(layers.get('0,1')!.children).toHaveLength(0)
  })

  it.each([[1, 350], [8, 1050], [20, 2250]])('finishes the %i-column wave after propagation and the last shake (%i ms)', (columns, durationMs) => {
    const { wave, layers, face } = setup(columns)
    expect(wave.advance(durationMs - 1)).toBe(false)
    expect(face(`${columns - 1},0`).visible).toBe(true)
    if (columns > 1) expect(face('0,0').visible).toBe(false)
    expect(wave.advance(1)).toBe(true)
    for (const layer of layers.values()) {
      expect(layer.children.at(-1)!.visible).toBe(false)
      expect(layer.position.x).toBe(0)
      expect(layer.position.y).toBe(0)
    }
    wave.destroy()
  })

  it('preserves progress across a redraw and removes overlays on cancellation', () => {
    const { wave, layers, face } = setup(8)
    wave.advance(600)
    const oldFace = face('0,0')
    wave.clearCells()
    expect(oldFace.destroyed).toBe(true)
    wave.setCells(layers, 70, 70, 0.04)
    expect(face('0,0').visible).toBe(false)
    expect(face('5,0').visible).toBe(true)
    expect(face('7,0').visible).toBe(false)
    const activeFace = face('5,0')
    wave.destroy()
    expect(activeFace.destroyed).toBe(true)
    expect(layers.get('5,0')!.children[0].visible).toBe(true)
    expect(layers.get('5,0')!.position.x).toBe(0)
  })

  it('skips animation for a zero duration', () => {
    const { wave, face } = setup(8, true, { ...CASCADE_LOCK_EFFECTS.shake, durationSeconds: 0 })
    expect(face('0,0').visible).toBe(false)
    expect(wave.advance(0)).toBe(true)
    wave.destroy()
  })
})
