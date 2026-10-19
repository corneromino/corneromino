import { Application, type ApplicationOptions } from 'pixi.js'

export interface PixiCanvasHostOptions {
  app?: Application
  canvasClassName: string
  container: HTMLElement
  init: Partial<ApplicationOptions>
  onReady: (app: Application) => void
  onResize: (app: Application, width: number, height: number) => void
}

/** Owns Pixi initialization, mounting, resize observation and application teardown. */
export class PixiCanvasHost {
  readonly app: Application
  private resizeObserver: ResizeObserver | undefined
  private disposed = false
  private initialized = false
  private readonly options: PixiCanvasHostOptions

  constructor(options: PixiCanvasHostOptions) {
    this.options = options
    this.app = options.app ?? new Application()
  }

  async start(): Promise<boolean> {
    const { container, init, onReady } = this.options
    await this.app.init({
      antialias: true,
      autoDensity: true,
      height: Math.max(1, container.clientHeight),
      resolution: window.devicePixelRatio,
      width: Math.max(1, container.clientWidth),
      ...init,
    })
    this.initialized = true
    if (this.disposed) {
      this.app.destroy(true)
      return false
    }

    this.app.canvas.className = this.options.canvasClassName
    container.appendChild(this.app.canvas)
    onReady(this.app)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    return true
  }

  resize() {
    if (this.disposed || !this.initialized) return
    const { container, onResize } = this.options
    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return
    this.app.renderer.resize(width, height)
    onResize(this.app, width, height)
  }

  destroy() {
    this.disposed = true
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    if (this.initialized) this.app.destroy(true)
  }
}
