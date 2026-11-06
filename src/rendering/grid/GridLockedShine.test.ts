import { Container, Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { GridLockedShine } from './GridLockedShine'

function projection(cell: Container) {
  return cell.getChildByLabel('locked-shine', true) as Graphics
}

function expectAligned(first: Graphics, second: Graphics) {
  for (const point of [{ x: 0, y: 0 }, { x: 4, y: -150 }, { x: 10, y: 200 }]) {
    const a = first.toGlobal(point)
    const b = second.toGlobal(point)
    expect(a.x).toBeCloseTo(b.x)
    expect(a.y).toBeCloseTo(b.y)
  }
}

describe('board-wide locked-cell shine', () => {
  it('keeps distant and moving cells on the same diagonal band through pan and zoom', () => {
    const board = new Container()
    const first = board.addChild(new Container())
    const second = board.addChild(new Container())
    second.position.set(250, 350)
    const effect = new GridLockedShine(board)
    effect.setBounds(400, 600, 50)
    effect.setCell(first, 50, 50, 2)
    effect.setCell(second, 50, 50, 2)
    effect.render(2000)
    expectAligned(projection(first), projection(second))

    board.position.set(-73, 48)
    board.scale.set(2.5)
    second.position.set(228, 305)
    second.pivot.set(25, 25)
    second.rotation = 0.17
    second.scale.set(0.75, 0.9)
    effect.render(2000)
    expectAligned(projection(first), projection(second))

    // Newly locked cells join the in-flight band instead of starting a sweep.
    const third = board.addChild(new Container({ x: 100, y: 150 }))
    effect.setCell(third, 50, 50, 2)
    effect.render(2000)
    expectAligned(projection(first), projection(third))
    effect.destroy()
    board.destroy({ children: true })
  })

  it('anchors Infinite to its visible board as world rows scroll and recycle', () => {
    const board = new Container()
    const cell = board.addChild(new Container())
    const effect = new GridLockedShine(board)
    effect.setBounds(400, 600, 50)
    effect.setCell(cell, 50, 50, 2)
    effect.render(2000)
    const before = projection(cell).toGlobal({ x: 0, y: 0 })
    board.y = -9000
    cell.y = 9000
    effect.render(2000, 0, 9000)
    expect(projection(cell).toGlobal({ x: 0, y: 0 })).toEqual(before)
    effect.destroy()
    board.destroy({ children: true })
  })

  it('waits between complete board-wide passes', () => {
    const board = new Container()
    const cell = board.addChild(new Container())
    const effect = new GridLockedShine(board)
    effect.setBounds(400, 600, 50)
    effect.setCell(cell, 50, 50, 2)
    const layer = projection(cell).parent!

    effect.render(2_999)
    expect(layer.visible).toBe(true)
    effect.render(3_000)
    expect(layer.visible).toBe(false)
    effect.render(5_999)
    expect(layer.visible).toBe(false)
    effect.render(6_000)
    expect(layer.visible).toBe(true)
    effect.destroy()
    board.destroy({ children: true })
  })

  it('keeps rebuilt masks and bands hidden together until a positioned sweep is ready', () => {
    const board = new Container()
    const first = board.addChild(new Container())
    const second = board.addChild(new Container({ x: 250, y: 350 }))
    const effect = new GridLockedShine(board)
    effect.setBounds(400, 600, 50)

    for (let attempt = 0; attempt < 20; attempt += 1) {
      effect.setCell(first, 50, 50, 2)
      effect.setCell(second, 50, 50, 2)
      const shine = projection(second)
      const layer = shine.parent!
      const mask = shine.mask as Graphics
      expect(layer.visible).toBe(false)
      expect(mask.parent).toBe(layer)

      second.position.set(250 + attempt, 350 - attempt)
      second.scale.set(0.75)
      effect.render(4_500)
      expect(layer.visible).toBe(false)
      expectAligned(projection(first), shine)

      effect.render(6_500)
      expect(layer.visible).toBe(true)
      expectAligned(projection(first), shine)
      effect.render(9_000)
      expect(layer.visible).toBe(false)

      effect.clearCells()
      expect(layer.destroyed).toBe(true)
      expect(shine.destroyed).toBe(true)
      expect(mask.destroyed).toBe(true)
      expect(second.children).toHaveLength(0)
    }
    effect.destroy()
    board.destroy({ children: true })
  })

  it('clips the original stripe styling to cell interiors and safely releases shared geometry', () => {
    const board = new Container()
    const cell = board.addChild(new Container())
    const effect = new GridLockedShine(board)
    effect.setBounds(400, 600, 50)
    effect.setCell(cell, 50, 50, 2)
    const shine = projection(cell)
    const context = shine.context
    const mask = shine.mask as Graphics
    expect(mask.containsPoint({ x: 25, y: 25 })).toBe(true)
    expect(mask.containsPoint({ x: 1, y: 25 })).toBe(false)
    expect(context.instructions.map((instruction) => instruction.action === 'fill' && [instruction.data.style.color, instruction.data.style.alpha]))
      .toEqual([[0xffffff, 0.12], [0xffffff, 0.72], [0xffffff, 0.12]])
    expect(context.bounds.width).toBeCloseTo(50 * 0.22)

    effect.removeCell(cell)
    expect(shine.destroyed).toBe(true)
    expect(mask.destroyed).toBe(true)
    expect(context.destroyed).toBe(false)
    expect(cell.children).toHaveLength(0)
    effect.setCell(cell, 50, 50, 2)
    effect.setBounds(800, 1200, 100)
    effect.render(2000)
    expect(projection(cell).context).toBe(context)
    expect(context.bounds.width).toBeCloseTo(100 * 0.22)
    effect.destroy()
    expect(context.destroyed).toBe(true)
    expect(cell.children).toHaveLength(0)
    board.destroy({ children: true })
  })
})
