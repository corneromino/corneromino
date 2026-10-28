import type { VhsCrtEffectConfig } from '@/rendering/pixi/VhsCrtEffect'

/** Infinite's viewport-wide TV effect. Set enabled to false to bypass both GPU passes. */
export const CLASSIC_INFINITE_VHS_CRT: VhsCrtEffectConfig = {
  enabled: true,
  animationSpeed: 10,
  crt: {
    lineWidth: 0,
    lineContrast: 0.2,
    curvature: 1,
    lineSpeed: 1.2,
    noise: 0.0,
    noiseSize: 10,
    noiseRefreshHz: 24,
    vignetting: 0.0,
    vignettingAlpha: 0.25,
    vignettingBlur: 0.3,
  },
  vhs: {
    rgbOffset: 2,
    distortion: 1,
    bands: 8,
    refreshHz: 120,
  },
}

export const DISTORTED_RGB_EFFECT: VhsCrtEffectConfig = {
  enabled: true,
  animationSpeed: 10,
  crt: {
    lineWidth: 0,
    lineContrast: 0.2,
    curvature: 1,
    lineSpeed: 1.2,
    noise: 0,
    noiseSize: 10,
    noiseRefreshHz: 24,
    vignetting: 0,
    vignettingAlpha: 0.25,
    vignettingBlur: 0.3,
  },
  vhs: {
    rgbOffset: 100,
    distortion: 1,
    bands: 8,
    refreshHz: 120,
  },
}