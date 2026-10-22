/** Keep portaled dialogs inside the visible area when the mobile keyboard opens. */
export function observeDialogViewport(viewport: VisualViewport | null, root: HTMLElement): () => void {
  if (!viewport) return () => undefined

  function update() {
    // Pinch zoom should magnify the existing layout, not resize it under the user.
    if (!viewport || viewport.scale !== 1 || viewport.height <= 0) return
    root.style.setProperty('--dialog-viewport-height', `${viewport.height}px`)
    root.style.setProperty('--dialog-viewport-top', `${Math.max(0, viewport.offsetTop)}px`)
  }

  update()
  viewport.addEventListener('resize', update, { passive: true })
  viewport.addEventListener('scroll', update, { passive: true })
  return () => {
    viewport.removeEventListener('resize', update)
    viewport.removeEventListener('scroll', update)
    root.style.removeProperty('--dialog-viewport-height')
    root.style.removeProperty('--dialog-viewport-top')
  }
}
