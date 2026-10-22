import { describe, expect, it } from 'vitest'
import { observeDialogViewport } from './dialogViewport'

function setup() {
  const viewport = Object.assign(new EventTarget(), { height: 700, offsetTop: 0, scale: 1 })
  const properties = new Map<string, string>()
  const root = {
    style: {
      setProperty: (key: string, value: string) => properties.set(key, value),
      removeProperty: (key: string) => properties.delete(key),
    },
  } as unknown as HTMLElement
  return { viewport, root, properties }
}

describe('dialog visual viewport', () => {
  it('tracks keyboard resizing and viewport panning without changing the app height', () => {
    const { viewport, root, properties } = setup()
    const dispose = observeDialogViewport(viewport as unknown as VisualViewport, root)
    expect(properties.get('--dialog-viewport-height')).toBe('700px')
    viewport.height = 320
    viewport.dispatchEvent(new Event('resize'))
    expect(properties.get('--dialog-viewport-height')).toBe('320px')
    viewport.offsetTop = 65
    viewport.dispatchEvent(new Event('scroll'))
    expect(properties.get('--dialog-viewport-top')).toBe('65px')
    expect(properties.has('--app-height')).toBe(false)
    viewport.height = 700
    viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('resize'))
    expect(properties.get('--dialog-viewport-height')).toBe('700px')
    expect(properties.get('--dialog-viewport-top')).toBe('0px')
    dispose()
  })

  it('preserves the layout during pinch zoom and ignores zero-sized viewports', () => {
    const { viewport, root, properties } = setup()
    const dispose = observeDialogViewport(viewport as unknown as VisualViewport, root)
    viewport.scale = 2
    viewport.height = 350
    viewport.offsetTop = 100
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
    expect(properties.get('--dialog-viewport-height')).toBe('700px')
    expect(properties.get('--dialog-viewport-top')).toBe('0px')
    viewport.scale = 1
    viewport.height = 0
    viewport.dispatchEvent(new Event('resize'))
    expect(properties.get('--dialog-viewport-height')).toBe('700px')
    dispose()
  })

  it('removes listeners and inline measurements on cleanup', () => {
    const { viewport, root, properties } = setup()
    const dispose = observeDialogViewport(viewport as unknown as VisualViewport, root)
    dispose()
    viewport.height = 300
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
    expect(properties.size).toBe(0)
  })

  it('uses the CSS viewport fallback when VisualViewport is unavailable', () => {
    const { root, properties } = setup()
    observeDialogViewport(null, root)()
    expect(properties.size).toBe(0)
  })
})
