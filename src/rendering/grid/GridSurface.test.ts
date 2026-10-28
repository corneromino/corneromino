import { Container, Rectangle, Texture, TextureSource, type Application } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { GridSurface } from './GridSurface'
import { GAME_COLORS } from '@/rendering/colors'

function setup() {
  const generatedBounds: Rectangle[] = []
  const generateTexture = vi.fn(({ target, frame }: { target: Container; frame: Rectangle }) => {
    generatedBounds.push(target.getLocalBounds().rectangle.clone())
    // Match Pixi's integer frame truncation rather than assuming a 56px tile.
    return new Texture({ source: new TextureSource({ width: frame.width | 0, height: frame.height | 0 }) })
  })
  const app = {
    renderer: { resolution: 1.25, generateTexture },
    canvas: { getBoundingClientRect: () => ({ left: 20, top: 30, width: 400, height: 300 }) },
    ticker: { add: vi.fn(), remove: vi.fn(), deltaMS: 16 },
  }
  const viewport = { width: 400, height: 300, cellSize: 56, fit: 'manual' as const }
  const appearance = { cellColor: GAME_COLORS.cellFill, borderColor: GAME_COLORS.cellBorder, backgroundColor: GAME_COLORS.cellBorder, borderSize: 2, borderRadius: 2, gap: 0 }
  const surface = new GridSurface(app as unknown as Application, { infinite: true }, viewport, appearance)
  return { surface, generateTexture, generatedBounds, app, viewport, appearance }
}

describe('shared textured grid surface', () => {
  it('scrolls textures, world layers and hit testing together without rebuilding a texture', () => {
    const { surface, generateTexture } = setup()
    const texture = surface.texture
    surface.setOffset(0, 14)
    expect(surface.texture).toBe(texture)
    expect(generateTexture).toHaveBeenCalledOnce()
    expect(surface.background.tilePosition.y).toBe(14)
    expect(surface.worldLayers.pieces.position.y).toBe(14)
    expect(surface.pointerToCell({ clientX: 20 + 28, clientY: 30 + 14 + 28 })).toEqual({ column: 0, row: 0 })
    surface.setOffset(0, 70)
    expect(surface.pointerToCell({ clientX: 20 + 28, clientY: 30 + 14 + 28 })).toEqual({ column: 0, row: -1 })
    expect(generateTexture).toHaveBeenCalledOnce()
    surface.destroy()
  })

  it.each([37.125, 43.75, 56.9])('bakes an unclipped, aligned tile for fractional cell size %s', (cellSize) => {
    const { surface, generateTexture, generatedBounds, viewport } = setup()
    surface.update({ ...viewport, cellSize })
    const { frame } = generateTexture.mock.calls.at(-1)![0]
    const bounds = generatedBounds.at(-1)!
    expect(Number.isInteger(frame.width)).toBe(true)
    expect(Number.isInteger(frame.height)).toBe(true)
    expect(bounds).toEqual(frame)
    expect(surface.texture.width).toBe(frame.width)
    expect(surface.background.tileScale.x * surface.texture.width).toBeCloseTo(cellSize)
    expect(surface.background.tileScale.y * surface.texture.height).toBeCloseTo(cellSize)
    surface.destroy()
  })

  it('rebakes at a new zoom and reuses that texture during pan/resize, keeping hit testing aligned', () => {
    const { surface, generateTexture, viewport } = setup()
    const texture = surface.texture
    surface.update({ ...viewport, zoom: 0.5, offsetX: 7, offsetY: 14 })
    expect(generateTexture).toHaveBeenCalledTimes(2)
    expect(surface.texture).not.toBe(texture)
    expect(texture.destroyed).toBe(true)
    expect(surface.background.tileScale.x * surface.texture.width).toBe(28)
    expect(surface.background.tilePosition.x).toBe(7)
    expect(surface.worldLayers.overlay.scale.x).toBe(28)
    expect(surface.worldLayers.overlay.position.y).toBe(14)
    expect(surface.pointerToCell({ clientX: 20 + 7 + 28 * 2.5, clientY: 30 + 14 + 28 * 3.5 })).toEqual({ column: 2, row: 3 })
    const zoomTexture = surface.texture
    surface.update({ ...viewport, zoom: 0.5, width: 800, height: 600, offsetX: 21, offsetY: 28 })
    expect(generateTexture).toHaveBeenCalledTimes(2)
    expect(surface.texture).toBe(zoomTexture)
    surface.destroy()
  })

  it('rebuilds and releases the old texture when appearance changes', () => {
    const { surface, generateTexture, viewport, appearance } = setup()
    const oldTexture = surface.texture
    surface.update(viewport, { ...appearance, borderRadius: 8 })
    expect(generateTexture).toHaveBeenCalledTimes(2)
    expect(oldTexture.destroyed).toBe(true)
    surface.destroy()
  })

  it('cleans up custom content, frame hooks and mode-owned effects', () => {
    const { surface, app } = setup()
    const content = new Container()
    surface.worldLayers.effects.addChild(content)
    const frame = vi.fn()
    const disposeEffect = vi.fn()
    surface.onFrame(frame)
    surface.onDispose(disposeEffect)
    app.ticker.add.mock.calls[0][0]()
    expect(frame).toHaveBeenCalledWith(16)
    const texture = surface.texture
    surface.destroy()
    expect(app.ticker.remove).toHaveBeenCalledOnce()
    expect(disposeEffect).toHaveBeenCalledOnce()
    expect(content.destroyed).toBe(true)
    expect(texture.destroyed).toBe(true)
  })
})
