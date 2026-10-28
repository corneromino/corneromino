import { Container, Graphics, Rectangle, Texture, TilingSprite, type Application } from 'pixi.js'
import { getGridMetrics, gridCellToScreen, isInsideGrid, screenToGridCell, type GridBounds, type GridMetrics, type GridViewport } from './gridGeometry'

export interface GridAppearance {
  cellColor: number
  borderColor: number
  backgroundColor: number
  /** Sizes in logical pixels at viewport.cellSize; they scale with zoom. */
  borderSize: number
  borderRadius: number
  gap: number
}

/** Shared texture-backed surface. Mode-owned drawings use the exposed layers. */
export class GridSurface {
  readonly root = new Container()
  readonly layers = {
    underPieces: new Container(),
    pieces: new Container(),
    effects: new Container(),
    overlay: new Container(),
  }
  /** Custom world-space drawings use cell coordinates and inherit pan/zoom. */
  readonly worldLayers = {
    underPieces: new Container(),
    pieces: new Container(),
    effects: new Container(),
    overlay: new Container(),
  }
  readonly background = new TilingSprite({ texture: Texture.WHITE, width: 1, height: 1 })
  private readonly backdrop = new Graphics()
  private textureKey = ''
  private tileTexture: Texture | undefined
  private viewport: GridViewport
  private readonly app: Application
  readonly bounds: GridBounds
  private appearance: GridAppearance
  private readonly cleanups = new Set<() => void>()
  metrics: GridMetrics

  constructor(
    app: Application,
    bounds: GridBounds,
    viewport: GridViewport,
    appearance: GridAppearance,
  ) {
    this.app = app
    this.bounds = bounds
    this.appearance = appearance
    this.viewport = viewport
    this.metrics = getGridMetrics(bounds, viewport)
    this.root.eventMode = 'none'
    this.layers.pieces.sortableChildren = true
    this.root.addChild(this.backdrop, this.background)
    for (const name of ['underPieces', 'pieces', 'effects', 'overlay'] as const) {
      this.root.addChild(this.layers[name], this.worldLayers[name])
    }
    this.update(viewport)
  }

  get texture(): Texture {
    return this.tileTexture!
  }

  update(viewport: GridViewport, appearance = this.appearance) {
    this.viewport = viewport
    this.appearance = appearance
    this.metrics = getGridMetrics(this.bounds, viewport)
    const { cellWidth, cellHeight, offsetX, offsetY, width, height } = this.metrics
    // Pixi generateTexture truncates frame dimensions to integer logical pixels.
    // Bake at the active zoom level so empty tiles remain sharp instead of
    // enlarging the fitted-view bitmap. Styling remains proportional to a cell.
    const zoom = viewport.zoom ?? 1
    const logicalTileSize = viewport.cellSize * zoom
    // Quantizing avoids generating a texture for every fractional pinch update.
    const size = Math.max(1, Math.ceil(logicalTileSize / 4) * 4)
    const styleScale = size / viewport.cellSize
    const resolution = Math.max(2, Math.ceil(this.app.renderer.resolution))
    const key = JSON.stringify([size, styleScale, resolution, appearance])
    if (key !== this.textureKey) {
      const gap = Math.min(size / 2, Math.max(0, appearance.gap * styleScale / 2))
      const border = Math.min((size - gap * 2) / 2, Math.max(0, appearance.borderSize * styleScale))
      const radius = Math.min((size - gap * 2) / 2, Math.max(0, appearance.borderRadius * styleScale))
      const tile = new Graphics().rect(0, 0, size, size).fill(appearance.backgroundColor)
      tile.roundRect(gap, gap, size - gap * 2, size - gap * 2, radius).fill(appearance.borderColor)
      const inset = gap + border
      if (size > inset * 2) {
        tile.roundRect(inset, inset, size - inset * 2, size - inset * 2, Math.max(0, radius - border)).fill(appearance.cellColor)
      }
      const previous = this.tileTexture
      this.tileTexture = this.app.renderer.generateTexture({ target: tile, frame: new Rectangle(0, 0, size, size), resolution, antialias: true })
      this.background.texture = this.tileTexture
      tile.destroy()
      previous?.destroy(true)
      this.textureKey = key
    }
    this.backdrop.clear().rect(0, 0, viewport.width, viewport.height).fill(appearance.backgroundColor)
    this.background.position.set(this.bounds.infinite ? 0 : offsetX, this.bounds.infinite ? 0 : offsetY)
    this.background.width = width
    this.background.height = height
    this.background.tileScale.set(cellWidth / this.texture.frame.width, cellHeight / this.texture.frame.height)
    this.background.tilePosition.set(this.bounds.infinite ? offsetX : 0, this.bounds.infinite ? offsetY : 0)
    for (const layer of Object.values(this.worldLayers)) {
      layer.position.set(offsetX, offsetY)
      layer.scale.set(cellWidth, cellHeight)
    }
  }

  cellToScreen(column: number, row: number) {
    return gridCellToScreen(this.metrics, column, row)
  }

  /** Translate the viewport without rebuilding textures or background geometry. */
  setOffset(offsetX: number, offsetY: number) {
    this.viewport = { ...this.viewport, offsetX, offsetY }
    this.metrics.offsetX = offsetX
    this.metrics.offsetY = offsetY
    if (this.bounds.infinite) this.background.tilePosition.set(offsetX, offsetY)
    else this.background.position.set(offsetX, offsetY)
    for (const layer of Object.values(this.worldLayers)) layer.position.set(offsetX, offsetY)
  }

  screenToCell(x: number, y: number) {
    return screenToGridCell(this.metrics, x, y)
  }

  pointerToCell(event: { clientX: number; clientY: number }) {
    const rect = this.app.canvas.getBoundingClientRect()
    return this.screenToCell(
      (event.clientX - rect.left) * this.viewport.width / rect.width,
      (event.clientY - rect.top) * this.viewport.height / rect.height,
    )
  }

  contains(column: number, row: number) {
    return isInsideGrid(this.bounds, column, row)
  }

  onFrame(callback: (deltaMs: number) => void): () => void {
    const tick = () => callback(this.app.ticker.deltaMS)
    this.app.ticker.add(tick)
    return this.onDispose(() => this.app.ticker.remove(tick))
  }

  /** Register custom filters/tweens/listeners for cleanup with the surface. */
  onDispose(cleanup: () => void): () => void {
    const dispose = () => {
      if (!this.cleanups.delete(dispose)) return
      cleanup()
    }
    this.cleanups.add(dispose)
    return dispose
  }

  destroy() {
    for (const dispose of this.cleanups) dispose()
    this.root.destroy({ children: true })
    this.tileTexture?.destroy(true)
  }
}
