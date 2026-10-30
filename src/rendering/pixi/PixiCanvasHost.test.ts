import { afterEach, describe, expect, it, vi } from 'vitest'

interface ApplicationStub {
  canvas: { className: string; remove: ReturnType<typeof vi.fn> }
  destroy: ReturnType<typeof vi.fn>
  init: ReturnType<typeof vi.fn>
  renderer?: { resize: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }
  stage: { destroy: ReturnType<typeof vi.fn> }
  ticker?: { destroy: ReturnType<typeof vi.fn> }
}

const applications: ApplicationStub[] = []

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = { className: '', remove: vi.fn() }
    destroy = vi.fn()
    init = vi.fn(async () => undefined)
    renderer = { resize: vi.fn(), destroy: vi.fn() }
    stage = { destroy: vi.fn() }
    ticker = { destroy: vi.fn() }
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

afterEach(() => vi.restoreAllMocks())

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
  const onReady = vi.fn()
  const onResize = vi.fn()
  const onDestroy = vi.fn()
  const onError = vi.fn()
  const host = new PixiCanvasHost({
    container, canvasClassName: 'size-full touch-none', init: { background: 0x123456 }, onReady, onResize, onDestroy, onError,
  })
  applications[0]!.canvas.remove.mockImplementation(() => { mountedCanvas = null })
  return { host, container, onReady, onResize, onDestroy, onError }
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
    expect(applications[0]!.destroy).toHaveBeenCalledWith({ removeView: true, releaseGlobalResources: false }, { children: true })
  })

  it('preserves shared renderer resources when disposed during asynchronous initialization', async () => {
    const { host, container, onReady, onResize, onDestroy, onError } = setup()
    const app = applications[0]!
    let finishInit!: () => void
    app.init.mockImplementation(() => new Promise<void>((resolve) => { finishInit = resolve }))
    const started = host.start()
    host.destroy()
    expect(app.destroy).not.toHaveBeenCalled()

    finishInit()
    await expect(started).resolves.toBe(false)
    expect(app.destroy).toHaveBeenCalledExactlyOnceWith({ removeView: true, releaseGlobalResources: false }, { children: true })
    expect(container.contains(app.canvas as unknown as Node)).toBe(false)
    expect(onReady).not.toHaveBeenCalled()
    expect(onResize).not.toHaveBeenCalled()
    expect(ResizeObserverStub.instances).toHaveLength(0)
    host.destroy()
    expect(onDestroy).toHaveBeenCalledOnce()
    expect(app.destroy).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it.each(['early', 'partial'] as const)('releases available resources after an %s init rejection without using application teardown', async (phase) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { host, onReady, onDestroy, onError } = setup()
    const app = applications[0]!
    if (phase === 'early') {
      app.renderer = undefined
      app.ticker = undefined
    }
    const error = new Error('Renderer initialization failed')
    app.init.mockRejectedValue(error)
    await expect(host.start()).resolves.toBe(false)
    host.destroy()
    expect(onReady).not.toHaveBeenCalled()
    expect(onDestroy).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    expect(app.destroy).not.toHaveBeenCalled()
    expect(app.stage.destroy).toHaveBeenCalledOnce()
    if (phase === 'partial') {
      expect(app.renderer!.destroy).toHaveBeenCalledExactlyOnceWith({ removeView: true, releaseGlobalResources: false })
      expect(app.ticker!.destroy).toHaveBeenCalledOnce()
    }
  })

  it.each(['ready', 'resize'] as const)('rolls back mode resources and the mounted canvas after a %s callback failure', async (phase) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { host, container, onReady, onResize, onDestroy, onError } = setup()
    const app = applications[0]!
    const error = new Error('Board setup failed')
    const stopModeResources = vi.fn()
    onReady.mockImplementation(() => {
      onDestroy.mockImplementation(stopModeResources)
      if (phase === 'ready') throw error
    })
    if (phase === 'resize') onResize.mockImplementation(() => { throw error })

    await expect(host.start()).resolves.toBe(false)
    host.destroy()
    expect(stopModeResources).toHaveBeenCalledOnce()
    expect(stopModeResources.mock.invocationCallOrder[0]).toBeLessThan(app.destroy.mock.invocationCallOrder[0])
    expect(app.destroy).toHaveBeenCalledOnce()
    expect(container.contains(app.canvas as unknown as Node)).toBe(false)
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    for (const observer of ResizeObserverStub.instances) {
      expect(observer.disconnect).toHaveBeenCalledOnce()
      const resizeCount = onResize.mock.calls.length
      observer.trigger()
      expect(onResize).toHaveBeenCalledTimes(resizeCount)
    }
  })

  it('silently releases resources when init rejects after unmount', async () => {
    const { host, onReady, onDestroy, onError } = setup()
    const app = applications[0]!
    let rejectInit!: (error: Error) => void
    app.init.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectInit = reject }))
    const started = host.start()
    host.destroy()
    expect(app.stage.destroy).not.toHaveBeenCalled()
    rejectInit(new Error('Late init rejection'))
    await expect(started).resolves.toBe(false)
    host.destroy()
    expect(onReady).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(onDestroy).toHaveBeenCalledOnce()
    expect(app.stage.destroy).toHaveBeenCalledOnce()
    expect(app.renderer!.destroy).toHaveBeenCalledOnce()
  })

  it('continues teardown even when owner cleanup throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { host, container, onResize, onDestroy, onError } = setup()
    const app = applications[0]!
    const error = new Error('Resize failed')
    onResize.mockImplementation(() => { throw error })
    onDestroy.mockImplementation(() => { throw new Error('Owner cleanup failed') })
    await expect(host.start()).resolves.toBe(false)
    expect(app.destroy).toHaveBeenCalledOnce()
    expect(container.contains(app.canvas as unknown as Node)).toBe(false)
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
  })
})
