import { Filter, GlProgram, GpuProgram } from 'pixi.js'

export interface InfiniteExitDistortionConfig {
  /** Enables the exit-edge distortion pass. */
  enabled: boolean
  /** Height of the bottom distortion area, measured in visible cell rows. */
  heightCells: number
  /** Maximum horizontal pull toward the screen center, in UV units. */
  horizontalPull: number
  /** Maximum upward texture sampling offset, in UV units. */
  verticalPull: number
}

const GLSL_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`

const GLSL_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uStart;
uniform float uHorizontalPull;
uniform float uVerticalPull;
void main(void) {
  float progress = smoothstep(uStart, 1.0, vTextureCoord.y);
  progress *= progress;
  vec2 uv = vTextureCoord;
  uv.x = mix(uv.x, 0.5, progress * uHorizontalPull);
  uv.y -= progress * uVerticalPull;
  finalColor = texture(uTexture, clamp(uv, vec2(0.001), vec2(0.999)));
}`

const WGSL_VERTEX = `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, };
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VertexOutput {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return VertexOutput(vec4<f32>(position, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}`

const WGSL_FRAGMENT = `
struct ExitUniforms { uStart: f32, uHorizontalPull: f32, uVerticalPull: f32, uPadding: f32, };
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> exitUniforms: ExitUniforms;
@fragment fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  var progress = smoothstep(exitUniforms.uStart, 1.0, uv.y);
  progress *= progress;
  var distorted = uv;
  distorted.x = mix(distorted.x, 0.5, progress * exitUniforms.uHorizontalPull);
  distorted.y -= progress * exitUniforms.uVerticalPull;
  return textureSample(uTexture, uSampler, clamp(distorted, vec2<f32>(0.001), vec2<f32>(0.999)));
}`

/** A distortion-only sink at Infinite's bottom edge. It draws no black-hole artwork. */
export class InfiniteExitDistortionEffect {
  readonly filter: Filter
  private readonly uniforms: { uHorizontalPull: number; uPadding: number; uStart: number; uVerticalPull: number }

  constructor(config: InfiniteExitDistortionConfig, visibleRows: number) {
    this.filter = new Filter({
      glProgram: GlProgram.from({ fragment: GLSL_FRAGMENT, name: 'infinite-exit-distortion', vertex: GLSL_VERTEX }),
      gpuProgram: GpuProgram.from({
        fragment: { entryPoint: 'mainFragment', source: WGSL_FRAGMENT },
        vertex: { entryPoint: 'mainVertex', source: WGSL_VERTEX },
      }),
      resources: {
        exitUniforms: {
          uHorizontalPull: { type: 'f32', value: 0 },
          uPadding: { type: 'f32', value: 0 },
          uStart: { type: 'f32', value: 1 },
          uVerticalPull: { type: 'f32', value: 0 },
        },
      },
    })
    this.filter.resolution = 'inherit'
    this.uniforms = this.filter.resources.exitUniforms.uniforms as typeof this.uniforms
    this.configure(config, visibleRows)
  }

  configure(config: InfiniteExitDistortionConfig, visibleRows: number) {
    const rows = Math.max(1, visibleRows)
    const height = Math.min(rows, Math.max(0, config.heightCells))
    this.uniforms.uStart = 1 - height / rows
    this.uniforms.uHorizontalPull = Math.max(0, config.horizontalPull)
    this.uniforms.uVerticalPull = Math.max(0, config.verticalPull)
  }

  destroy() { this.filter.destroy() }
}
