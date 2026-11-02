import { Container, Graphics, GraphicsContext, Matrix } from 'pixi.js'
import { getGridSquircleRadius } from './gridSquircle'

const ROTATION = -0.35
/** Time for one shine to travel across the board. */
const CYCLE_MS = 3000
/** Time to wait with no shine visible before the next board-wide sweep. */
const INTERVAL_MS = 3000

/**
 * One board-space light band, projected through locked-cell masks. The clipped
 * views keep each cell's draw order and animated outline while sharing geometry
 * and a single sweep position (including its vertical, diagonal alignment).
 */
export class GridLockedShine {
  private readonly band = new GraphicsContext()
  private readonly cells = new Map<Container, { shine: Graphics; mask: Graphics }>()
  private readonly bandTransform = new Matrix()
  private readonly worldTransform = new Matrix()
  private readonly cellTransform = new Matrix()
  private readonly board: Container
  private width = 0
  private height = 0
  private cellWidth = 0

  constructor(board: Container) {
    this.board = board
  }

  setBounds(width: number, height: number, cellWidth: number) {
    const redraw = this.height !== height || this.cellWidth !== cellWidth
    this.width = width
    this.height = height
    this.cellWidth = cellWidth
    if (!redraw) return

    // Long enough to cover the full board at the original tilt, with room for
    // cell movement at the edges. Stripe widths remain relative to ONE cell.
    const length = (height + cellWidth * 2) / Math.cos(ROTATION)
    this.band.clear()
      .rect(0, -length / 2, cellWidth * 0.08, length).fill({ color: 0xffffff, alpha: 0.12 })
      .rect(cellWidth * 0.08, -length / 2, cellWidth * 0.06, length).fill({ color: 0xffffff, alpha: 0.72 })
      .rect(cellWidth * 0.14, -length / 2, cellWidth * 0.08, length).fill({ color: 0xffffff, alpha: 0.12 })
  }

  setCell(parent: Container, width: number, height: number, inset: number) {
    let cell = this.cells.get(parent)
    if (!cell) {
      const mask = new Graphics({ eventMode: 'none' })
      const shine = new Graphics({ context: this.band, eventMode: 'none', label: 'locked-shine' })
      shine.mask = mask
      parent.addChild(mask, shine)
      cell = { shine, mask }
      this.cells.set(parent, cell)
    }
    cell.mask.clear()
      .roundRect(inset, inset, width - inset * 2, height - inset * 2, getGridSquircleRadius(width - inset * 2, height - inset * 2))
      .fill(0xffffff)
  }

  /** Origin is in board coordinates; Infinite supplies its visible top edge. */
  render(timeMs: number, x = 0, y = 0) {
    if (this.cells.size === 0) return
    const elapsed = timeMs % (CYCLE_MS + INTERVAL_MS)
    if (elapsed >= CYCLE_MS) {
      for (const { shine } of this.cells.values()) shine.visible = false
      return
    }
    const phase = elapsed / CYCLE_MS
    const diagonalReach = Math.abs(Math.tan(ROTATION)) * this.height / 2
    const start = -diagonalReach - this.cellWidth * 1.5
    const end = this.width + diagonalReach + this.cellWidth
    const cosine = Math.cos(ROTATION)
    const sine = Math.sin(ROTATION)
    this.bandTransform.set(cosine, sine, -sine, cosine, x + start + phase * (end - start), y + this.height / 2)
    this.board.getGlobalTransform(this.worldTransform).append(this.bandTransform)

    for (const [parent, { shine }] of this.cells) {
      shine.visible = true
      // Cancel each cell's transform so every clipped view samples the SAME
      // board-space band, even during a pop, shake, gravity move, pan or zoom.
      parent.getGlobalTransform(this.cellTransform).invert().append(this.worldTransform)
      shine.setFromMatrix(this.cellTransform)
    }
  }

  removeCell(parent: Container) {
    const cell = this.cells.get(parent)
    if (!cell) return
    cell.shine.mask = null
    cell.shine.destroy()
    cell.mask.destroy()
    this.cells.delete(parent)
  }

  clearCells() {
    for (const parent of this.cells.keys()) this.removeCell(parent)
  }

  destroy() {
    this.clearCells()
    this.band.destroy()
  }
}
