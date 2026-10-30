import { Application, type ApplicationOptions } from 'pixi.js'

// `destroy(true)` also clears Pixi's global pools, which can invalidate batches
// still in use by another canvas (e.g. the game behind a dialog).
const DESTROY_OPTIONS = { removeView: true, releaseGlobalResources: false }

export interface PixiCanvasHostOptions {
  app?: Application
  canvasClassName: string
  container: HTMLElement
  init: Partial<ApplicationOptions>
  onReady: (app: Application) => void
  onResize: (app: Application, width: number, height: number) => void
  /** Releases mode-owned resources, including partially completed setup. */
  onDestroy?: () => void
  onError: (error: unknown) => void
}

/** Owns Pixi initialization, mounting, resize observation and application teardown. */
export class PixiCanvasHost {
  readonly app: Application
  private resizeObserver: ResizeObserver | undefined
  private disposed = false
  private initialized = false
  private initSettled = false
  private ownerDestroyed = false
  private appDestroyed = false
  private canvas: HTMLCanvasElement | undefined
  private startPromise: Promise<boolean> | undefined
  private readonly options: PixiCanvasHostOptions

  constructor(options: PixiCanvasHostOptions) {
    this.options = options
    this.app = options.app ?? new Application()
  }

  start(): Promise<boolean> {
    this.startPromise ??= this.initialize()
    return this.startPromise
  }

  private async initialize(): Promise<boolean> {
    if (this.disposed) return false
    const { container, init, onReady } = this.options
    try {
      await this.app.init({
        antialias: true,
        autoDensity: true,
        height: Math.max(1, container.clientHeight),
        resolution: window.devicePixelRatio,
        width: Math.max(1, container.clientWidth),
        ...init,
      })
      this.initialized = true
      this.initSettled = true
      if (this.disposed) {
        this.destroy()
        return false
      }

      this.canvas = this.app.canvas
      this.canvas.className = this.options.canvasClassName
      container.appendChild(this.canvas)
      onReady(this.app)
      if (this.disposed) return false
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(container)
      this.resize()
      return !this.disposed
    } catch (error) {
      this.initSettled = true
      this.fail(error)
      return false
    }
  }

  resize() {
    if (this.disposed || !this.initialized) return
    const { container, onResize } = this.options
    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return
    try {
      this.app.renderer.resize(width, height)
      onResize(this.app, width, height)
    } catch (error) {
      this.fail(error)
    }
  }

  private fail(error: unknown) {
    const reportError = !this.disposed
    this.destroy()
    // A pending init may reject after its React owner has unmounted.
    if (reportError) {
      console.error('Pixi canvas startup or resize failed.', error)
      this.cleanup(() => this.options.onError(error))
    }
  }

  private cleanup(action: () => void) {
    try {
      action()
      return true
    } catch (error) {
      // One failing disposer must not prevent the remaining resources releasing.
      console.error('Pixi canvas cleanup failed.', error)
      return false
    }
  }

  destroy() {
    this.disposed = true
    this.cleanup(() => this.resizeObserver?.disconnect())
    this.resizeObserver = undefined
    if (!this.ownerDestroyed) {
      this.ownerDestroyed = true
      this.cleanup(() => this.options.onDestroy?.())
    }
    // Never destroy an app while Pixi is still initializing it. Its settled
    // continuation handles teardown without calling the old owner again.
    if (!this.initSettled || this.appDestroyed) return
    this.appDestroyed = true
    const { ticker, stage, renderer } = this.app
    const destroyed = this.initialized && this.cleanup(() => this.app.destroy(DESTROY_OPTIONS, { children: true }))
    if (!destroyed) {
      // Application.destroy assumes every plugin initialized (ResizePlugin in
      // particular). On rejection, release only resources that actually exist.
      this.cleanup(() => ticker?.destroy())
      this.cleanup(() => { if (stage && !stage.destroyed) stage.destroy({ children: true }) })
      this.cleanup(() => renderer?.destroy(DESTROY_OPTIONS))
    }
    this.cleanup(() => this.canvas?.remove())
    this.canvas = undefined
  }
}
