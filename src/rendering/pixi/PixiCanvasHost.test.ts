import { describe, expect, it, vi } from 'vitest'

interface ApplicationStub {
  canvas: { className: string }
  destroy: ReturnType<typeof vi.fn>
  init: ReturnType<typeof vi.fn>
  renderer: { resize: ReturnType<typeof vi.fn> } | undefined
  stage: { destroy: ReturnType<typeof vi.fn> }
}

const applications: ApplicationStub[] = []

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = { className: '' }
    destroy = vi.fn()
    init = vi.fn(async () => undefined)
    renderer = { resize: vi.fn() }
    stage = { destroy: vi.fn() }
    constructor() { applications.push(this as unknown as ApplicationStub) }
  },
}))

import { PixiCanvasHost } from './PixiCanvasHost'

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = []
  readonly disconnect = vi.fn()
  readonly observe = vi.fn()
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverStub.instances.push(this)
  }
  trigger() { this.callback([], this as unknown as ResizeObserver) }
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)
vi.stubGlobal('window', { devicePixelRatio: 2 })

function setup() {
  applications.length = 0
  ResizeObserverStub.instances.length = 0
  let mountedCanvas: unknown = null
  const container = {
    clientHeight: 180,
    clientWidth: 320,
    appendChild: (canvas: unknown) => { mountedCanvas = canvas },
    contains: (canvas: unknown) => mountedCanvas === canvas,
  } as unknown as HTMLElement
  const onBeforeDestroy = vi.fn()
  const onReady = vi.fn()
  const onResize = vi.fn()
  const host = new PixiCanvasHost({
    container, canvasClassName: 'size-full touch-none', init: { background: 0x123456 }, onBeforeDestroy, onReady, onResize,
  })
  return { host, container, onBeforeDestroy, onReady, onResize }
}

describe('PixiCanvasHost', () => {
  it('initializes, mounts and reports its initial size once', async () => {
    const { host, container, onReady, onResize } = setup()
    await expect(host.start()).resolves.toBe(true)
    const app = applications[0]!
    expect(app.init).toHaveBeenCalledWith(expect.objectContaining({ background: 0x123456, width: 320, height: 180 }))
    expect(container.contains(app.canvas as unknown as Node)).toBe(true)
    expect(app.canvas.className).toBe('size-full touch-none')
    expect(onReady).toHaveBeenCalledWith(app)
    expect(app.renderer!.resize).toHaveBeenCalledWith(320, 180)
    expect(onResize).toHaveBeenCalledWith(app, 320, 180)
    host.destroy()
  })

  it('uses one observer and stops resizing after teardown', async () => {
    const { host, onResize } = setup()
    await host.start()
    const observer = ResizeObserverStub.instances[0]!
    observer.trigger()
    expect(onResize).toHaveBeenCalledTimes(2)
    host.destroy()
    observer.trigger()
    expect(onResize).toHaveBeenCalledTimes(2)
    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(applications[0]!.destroy).toHaveBeenCalledWith({ removeView: true, releaseGlobalResources: false })
  })

  it('preserves shared renderer resources when disposed during asynchronous initialization', async () => {
    const { host, container, onReady, onResize } = setup()
    const app = applications[0]!
    let finishInit!: () => void
    app.init.mockImplementation(() => new Promise<void>((resolve) => { finishInit = resolve }))
    const started = host.start()
    host.destroy()
    expect(app.destroy).not.toHaveBeenCalled()

    finishInit()
    await expect(started).resolves.toBe(false)
    expect(app.destroy).toHaveBeenCalledExactlyOnceWith({ removeView: true, releaseGlobalResources: false })
    expect(container.contains(app.canvas as unknown as Node)).toBe(false)
    expect(onReady).not.toHaveBeenCalled()
    expect(onResize).not.toHaveBeenCalled()
    expect(ResizeObserverStub.instances).toHaveLength(0)
  })

  it('destroys a partially initialized application when initialization rejects', async () => {
    const { host, onReady, onResize } = setup()
    const app = applications[0]!
    const failure = new Error('renderer initialization failed')
    app.init.mockRejectedValue(failure)

    await expect(host.start()).rejects.toBe(failure)

    expect(app.destroy).toHaveBeenCalledExactlyOnceWith({ removeView: true, releaseGlobalResources: false })
    expect(onReady).not.toHaveBeenCalled()
    expect(onResize).not.toHaveBeenCalled()
    expect(ResizeObserverStub.instances).toHaveLength(0)
    host.destroy()
    expect(app.destroy).toHaveBeenCalledOnce()
  })

  it('destroys the stage when initialization fails before a renderer exists', async () => {
    const { host } = setup()
    const app = applications[0]!
    app.renderer = undefined
    app.init.mockRejectedValue(new Error('renderer unavailable'))

    await expect(host.start()).rejects.toThrow('renderer unavailable')

    expect(app.destroy).not.toHaveBeenCalled()
    expect(app.stage.destroy).toHaveBeenCalledExactlyOnceWith({ children: true })
  })

  it('rolls back owner resources and Pixi when setup fails after initialization', async () => {
    const { host, onBeforeDestroy, onReady } = setup()
    const app = applications[0]!
    const failure = new Error('canvas setup failed')
    onReady.mockImplementation(() => { throw failure })

    await expect(host.start()).rejects.toBe(failure)

    expect(onBeforeDestroy).toHaveBeenCalledOnce()
    expect(app.destroy).toHaveBeenCalledExactlyOnceWith({ removeView: true, releaseGlobalResources: false })
    expect(ResizeObserverStub.instances).toHaveLength(0)
  })

  it('disconnects its observer and rolls back when the initial resize fails', async () => {
    const { host, onResize } = setup()
    const app = applications[0]!
    const failure = new Error('initial resize failed')
    onResize.mockImplementation(() => { throw failure })

    await expect(host.start()).rejects.toBe(failure)

    expect(ResizeObserverStub.instances[0]!.disconnect).toHaveBeenCalledOnce()
    expect(app.destroy).toHaveBeenCalledExactlyOnceWith({ removeView: true, releaseGlobalResources: false })
  })
})
