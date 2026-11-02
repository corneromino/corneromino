import { Container, Graphics, Point, type Sprite } from 'pixi.js'
import { GAME_COLORS } from '@/rendering/colors'
import { VERIFICATION_FLIP_BATCH_SIZE, VERIFICATION_FLIP_DURATION_MS } from '@/game/gameConfig'
import { drawCellBody } from './drawCorneromino'
import { getGridSquircleRadius } from './gridSquircle'
import { VERIFICATION_COLORS, type VerificationRequest } from './verificationEffect'

interface FlipSettings {
  durationMs: number
  batchSize: number
}

interface FlipCell {
  batch: number
  layer: Container
  back: Graphics
  front: Array<{ child: Container; visible: boolean }>
  emptyTile?: Sprite
  position: Point
  pivot: Point
  scale: Point
  center: Point
}

/** Random, successive batches of opaque card flips, all sharing one deadline. */
export class GridVerificationFlip {
  private readonly request: VerificationRequest
  private readonly background: Container
  private readonly backgroundVisible: boolean
  private readonly durationMs: number
  private readonly batchSize: number
  private readonly random: () => number
  private order: Map<string, number> | undefined
  private cells: FlipCell[] = []
  private elapsedMs = 0
  private reversing = false
  private width = 0
  private height = 0

  constructor(request: VerificationRequest, background: Container, settings: FlipSettings, random = Math.random) {
    this.request = request
    this.background = background
    this.backgroundVisible = background.visible
    this.durationMs = Number.isFinite(settings.durationMs) ? Math.max(0, settings.durationMs) : VERIFICATION_FLIP_DURATION_MS
    this.batchSize = Number.isFinite(settings.batchSize) ? Math.max(1, Math.floor(settings.batchSize)) : VERIFICATION_FLIP_BATCH_SIZE
    this.random = random
  }

  /** Rebind resized/redrawn cells while retaining the shuffled order and clock. */
  setCells(layers: ReadonlyMap<string, Container>, width: number, height: number, borderRatio: number, emptyTiles: ReadonlyMap<Container, Sprite>) {
    this.clearCells()
    this.width = width
    this.height = height
    if (!this.order) {
      const keys = [...layers.keys()]
      for (let index = keys.length - 1; index > 0; index--) {
        const swap = Math.floor(this.random() * (index + 1))
        ;[keys[index], keys[swap]] = [keys[swap], keys[index]]
      }
      this.order = new Map(keys.map((key, index) => [key, index]))
    }

    for (const [key, layer] of layers) {
      const index = this.order.get(key)
      if (index === undefined) continue
      const front = layer.children.map((child) => ({ child, visible: child.visible }))
      const back = new Graphics({ eventMode: 'none', label: 'verification-back' })
      drawCellBody(back, 0, 0, width, height, {
        fillColor: this.request.incorrectCellKeys.has(key) ? VERIFICATION_COLORS.incorrect : VERIFICATION_COLORS.correct,
        borderColor: GAME_COLORS.cellBorder,
        borderSize: Math.min(width, height) * borderRatio,
        borderRadius: getGridSquircleRadius(width, height),
      })
      layer.updateLocalTransform()
      const center = layer.localTransform.apply(new Point(width / 2, height / 2))
      this.cells.push({
        batch: Math.floor(index / this.batchSize), layer, back, front,
        emptyTile: emptyTiles.get(layer),
        position: layer.position.clone(), pivot: layer.pivot.clone(), scale: layer.scale.clone(), center,
      })
      layer.addChild(back)
    }
    this.render()
  }

  advance(deltaMs: number): boolean {
    if (Number.isFinite(deltaMs) && deltaMs > 0) {
      this.elapsedMs = this.reversing
        ? Math.max(0, this.elapsedMs - deltaMs)
        : Math.min(this.durationMs, this.elapsedMs + deltaMs)
    }
    this.render()
    return this.reversing ? this.elapsedMs <= 0 : this.elapsedMs >= this.durationMs
  }

  /** Turn the cards back over using the same grouped flip timing in reverse. */
  reverse() {
    this.reversing = true
  }

  render() {
    if (!this.cells.length) return
    // Individual empty tiles now rotate too, so the repeated static tile layer
    // must not show a second, stationary front behind the turning cards.
    this.background.visible = false
    const batchCount = Math.ceil((this.order?.size ?? 0) / this.batchSize)
    const batchDuration = this.durationMs / Math.max(1, batchCount)
    // Ease the board-wide clock in so the first cards begin gently and the
    // batches gain speed toward the shared deadline. Decreasing this same
    // clock during reversal gives an exact visual reverse of the forward flip.
    const normalizedElapsed = this.durationMs === 0 ? 1 : this.elapsedMs / this.durationMs
    const easedElapsed = this.durationMs * normalizedElapsed ** 2
    for (const cell of this.cells) {
      const progress = batchDuration === 0 ? 1 : Math.min(1, Math.max(0, easedElapsed / batchDuration - cell.batch))
      const showBack = progress >= 0.5
      for (const { child, visible } of cell.front) child.visible = !showBack && (visible || child === cell.emptyTile)
      cell.back.visible = showBack
      cell.layer.position.copyFrom(cell.center)
      cell.layer.pivot.set(this.width / 2, this.height / 2)
      // A vertical-axis half-turn: front narrows to its edge, then the back
      // expands. Avoid a singular matrix for Pixi's cell masks at the midpoint.
      cell.layer.scale.set(cell.scale.x * Math.max(0.0001, Math.abs(Math.cos(progress * Math.PI))), cell.scale.y)
    }
  }

  /** Expose the clean board for capture, cancellation and result dialogs. */
  hide() {
    this.background.visible = this.backgroundVisible
    for (const cell of this.cells) {
      cell.back.visible = false
      cell.layer.position.copyFrom(cell.position)
      cell.layer.pivot.copyFrom(cell.pivot)
      cell.layer.scale.copyFrom(cell.scale)
      for (const { child, visible } of cell.front) child.visible = visible
    }
  }

  clearCells() {
    this.hide()
    for (const cell of this.cells) cell.back.destroy()
    this.cells = []
  }

  destroy() { this.clearCells() }
}
