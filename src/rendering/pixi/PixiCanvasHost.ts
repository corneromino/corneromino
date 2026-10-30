import { Application, type ApplicationOptions } from 'pixi.js'

// `destroy(true)` also clears Pixi's global pools, which can invalidate batches
// still in use by another canvas (e.g. the game behind a dialog).
const DESTROY_OPTIONS = { removeView: true, releaseGlobalResources: false }

export interface PixiCanvasHostOptions {
  app?: Application
  canvasClassName: string
  container: HTMLElement
  init: Partial<ApplicationOptions>
  /** Releases mode-owned listeners, tickers and animations before Pixi teardown. */
  onBeforeDestroy?: (app: Application) => void
  onReady: (app: Application) => void
  onResize: (app: Application, width: number, height: number) => void
}

/** Owns Pixi initialization, mounting, resize observation and application teardown. */
export class PixiCanvasHost {
  readonly app: Application
  private applicationDestroyed = false
  private resizeObserver: ResizeObserver | undefined
  private disposed = false
  private initialized = false
  private initializing = false
  private ownerCleaned = false
  private readonly options: PixiCanvasHostOptions

  constructor(options: PixiCanvasHostOptions) {
    this.options = options
    this.app = options.app ?? new Application()
  }

  async start(): Promise<boolean> {
    if (this.disposed) return false
    const { container, init, onReady } = this.options
    this.initializing = true
    try {
      await this.app.init({
        antialias: true,
        autoDensity: true,
        height: Math.max(1, container.clientHeight),
        resolution: window.devicePixelRatio,
        width: Math.max(1, container.clientWidth),
        ...init,
      })
      this.initializing = false
      this.initialized = true
      if (this.disposed) {
        this.destroyApplication()
        return false
      }

      this.app.canvas.className = this.options.canvasClassName
      container.appendChild(this.app.canvas)
      onReady(this.app)
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(container)
      this.resize()
      return true
    } catch (error) {
      this.initializing = false
      this.resizeObserver?.disconnect()
      this.resizeObserver = undefined
      this.destroyApplication()
      throw error
    }
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
    if (this.disposed) return
    this.disposed = true
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    // Initialization owns the application until its promise settles. Its
    // continuation observes `disposed` and performs the deferred teardown.
    if (!this.initializing) this.destroyApplication()
  }

  private destroyApplication() {
    if (this.applicationDestroyed) return
    this.applicationDestroyed = true
    this.initialized = false
    if (!this.ownerCleaned) {
      this.ownerCleaned = true
      try { this.options.onBeforeDestroy?.(this.app) } catch (error) {
        console.error('Could not fully clean up a Pixi canvas before teardown.', error)
      }
    }

    // Pixi creates its stage before awaiting renderer detection. A rejected
    // init can therefore leave either only a stage or a partially ready
    // renderer. Use the full teardown when possible, with a stage-only
    // fallback that cannot invalidate resources owned by another canvas.
    if (this.app.renderer) {
      try {
        this.app.destroy(DESTROY_OPTIONS)
        return
      } catch {
        try { this.app.renderer?.destroy(DESTROY_OPTIONS) } catch { /* best-effort rollback */ }
      }
    }
    try { this.app.stage?.destroy({ children: true }) } catch { /* best-effort rollback */ }
  }
}
