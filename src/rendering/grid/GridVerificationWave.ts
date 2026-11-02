import { Container, Graphics } from 'pixi.js'
import { GAME_COLORS } from '@/rendering/colors'
import { drawCellBody } from './drawCorneromino'
import { getCellShakeOffset } from './cellShake'
import { getGridSquircleRadius } from './gridSquircle'

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
  face: Graphics
  x: number
  y: number
}

/** Opaque faces animate above the board without moving or hiding its artwork. */
export class GridVerificationWave {
  readonly overlay = new Container({ eventMode: 'none', label: 'verification-wave' })
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
  setCells(cellKeys: Iterable<string>, width: number, height: number, borderRatio: number) {
    this.clearCells()
    this.cellSize = Math.min(width, height)
    // The parent is GridSurface's world overlay (cell coordinates). Keep face
    // geometry and shake distances in fitted pixels while inheriting pan/zoom.
    this.overlay.scale.set(1 / width, 1 / height)
    for (const key of cellKeys) {
      const [column, row] = key.split(',').map(Number)
      const face = new Graphics()
      drawCellBody(face, 0, 0, width, height, {
        fillColor: this.request.isCorrect ? 0x5fc47a : 0xe4555c,
        borderColor: GAME_COLORS.cellBorder,
        borderSize: this.cellSize * borderRatio,
        borderRadius: getGridSquircleRadius(width, height),
      })
      face.label = 'verification-face'
      face.visible = false
      this.overlay.addChild(face)
      this.cells.push({ column, face, x: column * width, y: row * height })
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
      const offset = active
        ? getCellShakeOffset(localTime, duration, this.cellSize * this.shake.amplitudeCells, this.shake.frequencyHz)
        : { x: 0, y: 0 }
      cell.face.position.set(cell.x + offset.x, cell.y + offset.y)
    }
  }

  /** Temporarily expose the clean board for screenshot extraction. */
  hide() {
    for (const cell of this.cells) {
      cell.face.visible = false
    }
  }

  clearCells() {
    this.hide()
    for (const cell of this.cells) cell.face.destroy()
    this.cells = []
  }

  destroy() {
    this.clearCells()
    this.overlay.destroy()
  }
}
