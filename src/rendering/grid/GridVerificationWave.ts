import { Container, Graphics } from 'pixi.js'
import { GAME_COLORS } from '@/rendering/colors'
import { drawCellBody } from './drawCorneromino'
import { getCellShakeOffset } from './cellShake'

export interface VerificationWaveRequest {
  id: number
  isCorrect: boolean
}

interface ShakeSettings {
  amplitudeCells: number
  durationSeconds: number
  frequencyHz: number
  propagationCellsPerSecond: number
}

interface WaveCell {
  column: number
  layer: Container
  face: Graphics
  original: { child: Container; visible: boolean }[]
}

/** Colored faces share each cell's shake layer; original artwork is hidden, not tinted. */
export class GridVerificationWave {
  private cells: WaveCell[] = []
  private elapsedMs = 0
  private cellSize = 0
  private readonly request: VerificationWaveRequest
  private readonly durationMs: number
  private readonly shake: ShakeSettings

  constructor(request: VerificationWaveRequest, columns: number, shake: ShakeSettings) {
    this.request = request
    this.shake = shake
    // The last column starts after propagation, then finishes its own shake.
    this.durationMs = shake.durationSeconds > 0
      ? (Math.max(0, columns - 1) / Math.max(0.01, shake.propagationCellsPerSecond) + shake.durationSeconds) * 1000
      : 0
  }

  /** Rebind after a canvas redraw/resize without restarting the animation clock. */
  setCells(layers: ReadonlyMap<string, Container>, width: number, height: number, borderRatio: number) {
    this.clearCells()
    this.cellSize = Math.min(width, height)
    for (const [key, layer] of layers) {
      const face = new Graphics()
      const original = layer.children.map((child) => ({ child, visible: child.visible }))
      drawCellBody(face, 0, 0, width, height, {
        fillColor: this.request.isCorrect ? 0x5fc47a : 0xe4555c,
        borderColor: GAME_COLORS.cellBorder,
        borderSize: this.cellSize * borderRatio,
        borderRadius: this.cellSize * 0.02,
      })
      face.label = 'verification-face'
      face.visible = false
      layer.addChild(face)
      this.cells.push({ column: Number(key.split(',')[0]), layer, face, original })
    }
    this.render()
  }

  advance(deltaMs: number): boolean {
    if (Number.isFinite(deltaMs) && deltaMs > 0) this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + deltaMs)
    this.render()
    return this.elapsedMs >= this.durationMs
  }

  render() {
    const duration = Math.max(0, this.shake.durationSeconds)
    const propagation = Math.max(0.01, this.shake.propagationCellsPerSecond)
    for (const cell of this.cells) {
      const localTime = this.elapsedMs / 1000 - cell.column / propagation
      const active = this.elapsedMs < this.durationMs && localTime >= 0 && localTime < duration
      cell.face.visible = active
      for (const { child, visible } of cell.original) child.visible = active ? false : visible
      const offset = active
        ? getCellShakeOffset(localTime, duration, this.cellSize * this.shake.amplitudeCells, this.shake.frequencyHz)
        : { x: 0, y: 0 }
      cell.layer.position.set(offset.x, offset.y)
    }
  }

  /** Temporarily expose the clean board for screenshot extraction. */
  hide() {
    for (const cell of this.cells) {
      cell.face.visible = false
      cell.layer.position.set(0, 0)
      for (const { child, visible } of cell.original) child.visible = visible
    }
  }

  clearCells() {
    this.hide()
    for (const cell of this.cells) cell.face.destroy()
    this.cells = []
  }

  destroy() { this.clearCells() }
}
