import { describe, expect, it, vi } from 'vitest'

interface ApplicationStub {
  canvas: { className: string }
  destroy: ReturnType<typeof vi.fn>
  init: ReturnType<typeof vi.fn>
  renderer: { resize: ReturnType<typeof vi.fn> }
}

const applications: ApplicationStub[] = []

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = { className: '' }
    destroy = vi.fn()
    init = vi.fn(async () => undefined)
    renderer = { resize: vi.fn() }
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
  const onReady = vi.fn()
  const onResize = vi.fn()
  const host = new PixiCanvasHost({
    container, canvasClassName: 'size-full touch-none', init: { background: 0x123456 }, onReady, onResize,
  })
  return { host, container, onReady, onResize }
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
    expect(app.renderer.resize).toHaveBeenCalledWith(320, 180)
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
    expect(applications[0]!.destroy).toHaveBeenCalledWith(true)
  })
})
