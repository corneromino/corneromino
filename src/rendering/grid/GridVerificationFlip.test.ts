import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { createSeededRandom } from '@/game/random'
import { GridVerificationFlip } from './GridVerificationFlip'

function setup(count = 12, settings = { durationMs: 1000, batchSize: 5 }, random = () => 0.999) {
  const background = new Container()
  const layers = new Map<string, Container>()
  const emptyTiles = new Map<Container, Sprite>()
  for (let index = 0; index < count; index++) {
    const layer = new Container()
    if (index < 8) {
      layer.addChild(new Graphics().rect(0, 0, 50, 50).fill(0xffffff))
      layer.addChild(new Container({ visible: false }))
    } else {
      const tile = layer.addChild(new Sprite(Texture.WHITE))
      tile.visible = false
      emptyTiles.set(layer, tile)
    }
    layers.set(`${index % 4},${Math.floor(index / 4)}`, layer)
  }
  const incorrectCellKeys = new Set(['0,0', '1,0', '2,0', '3,0'])
  const flip = new GridVerificationFlip({ id: 1, isCorrect: false, incorrectCellKeys }, background, settings, random)
  flip.setCells(layers, 50, 50, 0.04, emptyTiles)
  const backs = () => [...layers.values()].map((layer) => layer.getChildByLabel('verification-back') as Graphics)
  const destroy = () => {
    flip.destroy()
    for (const layer of layers.values()) layer.destroy({ children: true })
    background.destroy()
  }
  return { flip, layers, emptyTiles, background, backs, destroy }
}

describe('verification flip', () => {
  it('flips five cells at a time, including the final partial batch, within one second', () => {
    const { flip, layers, backs, background, destroy } = setup()
    expect(background.visible).toBe(false)
    expect(backs().every((back) => !back.visible)).toBe(true)
    expect(flip.advance(100)).toBe(false)
    expect([...layers.values()].filter((layer) => layer.scale.x < 1)).toHaveLength(5)
    expect(flip.advance(100)).toBe(false)
    expect(backs().filter((back) => back.visible)).toHaveLength(5)
    expect(flip.advance(300)).toBe(false)
    expect(backs().filter((back) => back.visible)).toHaveLength(10)
    expect(flip.advance(499)).toBe(false)
    expect(flip.advance(1)).toBe(true)
    expect(backs().every((back) => back.visible && back.alpha === 1)).toBe(true)
    expect([...layers.values()].every((layer) => layer.scale.x === 1)).toBe(true)
    // Incorrect groups are red; correct groups and empty cells are green.
    expect(backs().map((back) => back.context.fillStyle.color)).toEqual([
      ...Array(4).fill(0xe4555c), ...Array(8).fill(0x5fc47a),
    ])
    expect(backs().every((back) => back.context.fillStyle.alpha === 1)).toBe(true)
    destroy()
  })

  it('honors a custom batch size and total duration', () => {
    const { flip, layers, backs, destroy } = setup(12, { durationMs: 2400, batchSize: 3 })
    flip.advance(150)
    expect([...layers.values()].filter((layer) => layer.scale.x < 1)).toHaveLength(3)
    flip.advance(150)
    expect(backs().filter((back) => back.visible)).toHaveLength(3)
    expect(flip.advance(2099)).toBe(false)
    expect(flip.advance(1)).toBe(true)
    expect(backs().every((back) => back.visible)).toBe(true)
    destroy()
  })

  it('turns the retained backs back over with the same batches in reverse', () => {
    const { flip, layers, backs, background, destroy } = setup()
    flip.advance(1000)
    expect(backs().every((back) => back.visible)).toBe(true)
    flip.reverse()
    expect(flip.advance(100)).toBe(false)
    // The last partial batch is the first to turn back over.
    expect([...layers.values()].filter((layer) => layer.scale.x < 1)).toHaveLength(2)
    expect(flip.advance(100)).toBe(false)
    expect(backs().filter((back) => back.visible)).toHaveLength(10)
    expect(flip.advance(799)).toBe(false)
    expect(flip.advance(1)).toBe(true)
    expect(backs().every((back) => !back.visible)).toBe(true)
    expect(background.visible).toBe(false)
    destroy()
  })

  it('shuffles once, preserves progress through capture and resize, and restores original artwork on cancellation', () => {
    const random = vi.fn(createSeededRandom('verification-flip'))
    const { flip, layers, emptyTiles, backs, background, destroy } = setup(12, { durationMs: 1000, batchSize: 5 }, random)
    flip.advance(200)
    const flippedKeys = () => [...layers].filter(([, layer]) => projection(layer).visible).map(([key]) => key)
    const before = flippedKeys()
    expect(before).toHaveLength(5)
    expect(before).not.toEqual([...layers.keys()].slice(0, 5))
    expect(random).toHaveBeenCalledTimes(11)
    const scales = [...layers.values()].map((layer) => layer.scale.x)
    flip.hide()
    expect(background.visible).toBe(true)
    expect(backs().every((back) => !back.visible)).toBe(true)
    expect([...layers.values()].every((layer) => layer.scale.x === 1 && layer.pivot.x === 0 && layer.x === 0)).toBe(true)
    expect([...emptyTiles.values()].every((tile) => !tile.visible)).toBe(true)
    flip.render()
    expect(flippedKeys()).toEqual(before)
    const oldBacks = backs()
    flip.setCells(new Map([...layers].reverse()), 70, 70, 0.04, emptyTiles)
    expect(random).toHaveBeenCalledTimes(11)
    expect(flippedKeys()).toEqual(before)
    expect([...layers.values()].map((layer) => layer.scale.x)).toEqual(scales)
    expect(oldBacks.every((back) => back.destroyed)).toBe(true)
    const newBacks = backs()
    flip.destroy()
    expect(newBacks.every((back) => back.destroyed)).toBe(true)
    expect(background.visible).toBe(true)
    expect([...layers.values()].slice(0, 8).every((layer) => layer.children[0].visible && !layer.children[1].visible)).toBe(true)
    expect([...emptyTiles.values()].every((tile) => !tile.visible)).toBe(true)
    destroy()
  })

  it('handles zero duration and invalid batch sizes without leaving cells unflipped', () => {
    const { flip, backs, destroy } = setup(3, { durationMs: 0, batchSize: 0 })
    expect(flip.advance(0)).toBe(true)
    expect(backs().every((back) => back.visible)).toBe(true)
    destroy()
  })
})

function projection(layer: Container) {
  return layer.getChildByLabel('verification-back') as Graphics
}
