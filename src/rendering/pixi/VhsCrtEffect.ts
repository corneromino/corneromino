import { Filter } from 'pixi.js'
import { CRTFilter, GlitchFilter } from 'pixi-filters'

export interface VhsCrtEffectConfig {
  enabled: boolean
  /** Multiplies animation speed. Set to 0 for a static effect. */
  animationSpeed: number
  crt: {
    /** Scanline width in logical pixels; 0 disables scanlines. */
    lineWidth: number
    lineContrast: number
    /** Bends the scanlines, rather than the grid's cell geometry. */
    curvature: number
    /** Scanline phase change per second. */
    lineSpeed: number
    /** Grain intensity, from 0 to 1. */
    noise: number
    noiseSize: number
    noiseRefreshHz: number
    /** Vignette size, opacity and softness, from 0 to 1. */
    vignetting: number
    vignettingAlpha: number
    vignettingBlur: number
  }
  vhs: {
    /** Red/blue channel separation in logical pixels. */
    rgbOffset: number
    /** Maximum horizontal tracking displacement in logical pixels. Keep small for accurate taps. */
    distortion: number
    /** Number of horizontal tracking bands (integer >= 1). */
    bands: number
    refreshHz: number
  }
}

/** Two reusable GPU passes: VHS tracking/color bleed, then CRT scanlines/grain. */
export class VhsCrtEffect {
  readonly filters: readonly Filter[]
  private readonly crt: CRTFilter
  private readonly vhs: GlitchFilter
  private config: VhsCrtEffectConfig
  private time = 0
  private noiseFrame = 0
  private trackingFrame = 0

  constructor(config: VhsCrtEffectConfig) {
    this.config = config
    this.crt = new CRTFilter({ seed: 0.5, verticalLine: false })
    this.vhs = new GlitchFilter({
      slices: config.vhs.bands,
      sampleSize: 256,
      // Clamp displaced edges instead of revealing transparent strips.
      fillMode: 3,
      direction: 0,
      seed: 0.5,
    })
    this.filters = [this.vhs, this.crt]
    this.configure(config)
  }

  configure(config: VhsCrtEffectConfig) {
    this.config = config
    const { crt, vhs } = config
    this.crt.lineWidth = crt.lineWidth
    this.crt.lineContrast = crt.lineContrast
    this.crt.curvature = crt.curvature
    this.crt.noise = crt.noise
    this.crt.noiseSize = crt.noiseSize
    this.crt.vignetting = crt.vignetting
    this.crt.vignettingAlpha = crt.vignettingAlpha
    this.crt.vignettingBlur = crt.vignettingBlur
    this.vhs.slices = vhs.bands
    this.vhs.offset = vhs.distortion
    this.vhs.red = { x: vhs.rgbOffset, y: 0 }
    this.vhs.blue = { x: -vhs.rgbOffset, y: 0 }
  }

  advance(deltaMs: number, paused: boolean) {
    if (paused || !this.config.enabled || this.config.animationSpeed <= 0 || !Number.isFinite(deltaMs) || deltaMs <= 0) return
    const { crt, vhs, animationSpeed } = this.config
    // A background tab must not cause a large visual jump on resume.
    this.time += Math.min(deltaMs, 100) / 1000 * animationSpeed
    this.crt.time = (this.time * crt.lineSpeed) % (Math.PI * 2)

    const noiseFrame = Math.floor(this.time * crt.noiseRefreshHz)
    if (noiseFrame !== this.noiseFrame) {
      this.noiseFrame = noiseFrame
      this.crt.seed = 0.1 + (noiseFrame * 0.61803398875 % 0.9)
    }
    const trackingFrame = Math.floor(this.time * vhs.refreshHz)
    if (trackingFrame !== this.trackingFrame) {
      this.trackingFrame = trackingFrame
      if (vhs.distortion > 0) this.vhs.refresh()
    }
    this.vhs.offset = vhs.distortion * (0.65 + Math.sin(this.time * 2) * 0.35)
    const colorOffset = vhs.rgbOffset * (0.85 + Math.sin(this.time * 1.7) * 0.15)
    this.vhs.red.x = colorOffset
    this.vhs.blue.x = -colorOffset
  }

  /** The owner must detach the filters before releasing their GPU resources. */
  destroy() {
    this.crt.destroy()
    this.vhs.destroy()
    // pixi-filters 6's GlitchFilter only destroys its displacement texture.
    // Also release the inherited shader bind groups and renderer listeners.
    Filter.prototype.destroy.call(this.vhs)
  }
}
