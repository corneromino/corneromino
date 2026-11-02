import { Container, Graphics, Texture, TextureSource, type Application } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { GridSurface } from './GridSurface'
import { GridVerificationWave } from './GridVerificationWave'

const SHAKE_SETTINGS = { amplitudeCells: 1, durationSeconds: 0.35, frequencyHz: 2, propagationCellsPerSecond: 10 }

function setup(columns: number, isCorrect = true, shake = SHAKE_SETTINGS) {
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
  wave.setCells(layers.keys(), 50, 50, 0.04)
  const face = (key: string) => wave.overlay.children[[...layers.keys()].indexOf(key)] as Graphics
  return { wave, layers, face }
}

describe('verification cell wave', () => {
  it.each([true, false])('shakes opaque faces above visible, stationary artwork, including empty cells (correct: %s)', (isCorrect) => {
    const { wave, layers, face } = setup(8, isCorrect)
    expect(face('0,0').visible).toBe(true)
    expect(face('0,0').alpha).toBe(1)
    expect(face('0,0').context.fillStyle.alpha).toBe(1)
    expect(face('0,0').context.fillStyle.color).toBe(isCorrect ? 0x5fc47a : 0xe4555c)
    expect(face('0,0').parent).toBe(wave.overlay)
    expect(wave.overlay.alpha).toBe(1)
    expect(face('0,1').visible).toBe(true)
    expect(layers.get('0,0')!.children[0].visible).toBe(true)
    expect(layers.get('0,0')!.children[1].visible).toBe(false)
    expect(face('7,0').visible).toBe(false)
    expect(layers.get('7,0')!.children[0].visible).toBe(true)

    wave.advance(30)
    expect(face('0,0').position.x).not.toBe(0)
    expect(face('0,0').position.x).toBe(face('0,1').position.x)
    expect(face('0,0').position.y).toBeCloseTo(face('0,1').position.y - 50)
    expect(layers.get('0,0')!.position.x).toBe(0)
    expect(layers.get('0,0')!.position.y).toBe(0)
    expect(layers.get('0,0')!.children[0].visible).toBe(true)
    wave.hide()
    expect(face('0,0').visible).toBe(false)
    expect(layers.get('0,0')!.children[0].visible).toBe(true)
    expect(layers.get('0,0')!.position.x).toBe(0)
    wave.render()
    expect(face('0,0').visible).toBe(true)
    wave.destroy()
    expect(wave.overlay.destroyed).toBe(true)
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
    for (const [key, layer] of layers) {
      expect(face(key).visible).toBe(false)
      const [x, y] = key.split(',').map(Number)
      expect(face(key).position.x).toBe(x * 50)
      expect(face(key).position.y).toBe(y * 50)
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
    wave.setCells(layers.keys(), 70, 70, 0.04)
    expect(face('0,0').visible).toBe(false)
    expect(face('5,0').visible).toBe(true)
    expect(face('7,0').visible).toBe(false)
    const activeFace = face('5,0')
    wave.destroy()
    expect(activeFace.destroyed).toBe(true)
    expect(layers.get('5,0')!.children[0].visible).toBe(true)
    expect(layers.get('5,0')!.position.x).toBe(0)
  })

  it('stays above the board and aligned through resizing, zooming and panning', () => {
    const { wave, layers, face } = setup(8)
    const app = { renderer: {
      resolution: 1,
      generateTexture: () => new Texture({ source: new TextureSource({ width: 100, height: 100 }) }),
    } } as unknown as Application
    const viewport = { width: 400, height: 100, cellSize: 50, fit: 'manual' as const }
    const surface = new GridSurface(app, { infinite: false, columns: 8, rows: 2 }, viewport, {
      cellColor: 0xffffff, borderColor: 0, backgroundColor: 0, borderSize: 2, borderRadius: 3, gap: 0,
    })
    const board = new Container({ sortableChildren: true })
    const original = layers.get('2,0')!
    original.zIndex = 1000
    board.addChild(original)
    surface.layers.pieces.addChild(board)
    surface.worldLayers.overlay.addChild(wave.overlay)
    expect(surface.root.getChildIndex(surface.worldLayers.overlay)).toBeGreaterThan(surface.root.getChildIndex(surface.layers.pieces))

    for (const view of [
      { cellSize: 50, zoom: 1, offsetX: 0, offsetY: 0 },
      { cellSize: 70, zoom: 2, offsetX: -45, offsetY: -20 },
    ]) {
      surface.update({ ...viewport, ...view })
      board.position.set(view.offsetX, view.offsetY)
      board.scale.set(view.zoom)
      original.position.set(2 * view.cellSize, 0)
      wave.setCells(layers.keys(), view.cellSize, view.cellSize, 0.04)
      const overlayPosition = face('2,0').getGlobalPosition()
      const originalPosition = original.getGlobalPosition()
      expect(overlayPosition.x).toBeCloseTo(originalPosition.x)
      expect(overlayPosition.y).toBeCloseTo(originalPosition.y)
    }

    wave.destroy()
    expect(surface.worldLayers.overlay.children).toHaveLength(0)
    expect(original.destroyed).toBe(false)
    surface.destroy()
  })

  it('skips animation for a zero duration', () => {
    const { wave, face } = setup(8, true, { ...SHAKE_SETTINGS, durationSeconds: 0 })
    expect(face('0,0').visible).toBe(false)
    expect(wave.advance(0)).toBe(true)
    wave.destroy()
  })
})
