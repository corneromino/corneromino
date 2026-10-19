# Shared game grid

Normal, Cascade and Sandbox use this renderer. Gameplay state and rules are supplied by each mode.

## Modules

- `GridSurface.ts`: repeated empty-cell texture, drawing layers, texture ownership and frame/cleanup hooks.
- `gridGeometry.ts`: finite/infinite bounds, contain/stretch/manual sizing, cell-to-screen and screen-to-cell conversion.
- `drawCorneromino.ts`: shared body and marker drawing; modes supply colors, dimensions, borders and outlines. Marker position and drawing are separate to allow interpolated corner animation.
- `gridInput.ts`: canvas input registration, tap/swipe recognition, repeated horizontal steps and cancellation. Modes connect actions through callbacks.

## Configuration and coordinates

Create a `GridSurface` after the Pixi application has initialized, then attach `surface.root` to the stage. Call `update(viewport, appearance?)` on resize or camera changes. Sizes use logical screen pixels (not canvas backing-buffer pixels).

- Finite bounds specify `columns` and `rows`; `fit: 'contain'` fits square cells and centers the board. `stretch` supports existing rectangular layouts.
- Infinite bounds use `fit: 'manual'`, `cellSize`, `zoom`, `offsetX` and `offsetY`.
- Border size, radius and gap are logical pixels at the configured base `cellSize`. Zoom scales them with the tile. `gap` is the total space between neighboring cell bodies.
- Each surface owns one empty-cell texture, regenerated only when its base size, resolution or appearance changes. Panning and zooming reuse it.
- Hit testing uses `pointerToCell`; finite-grid callers use `contains` to reject margins.

## Custom drawings and effects

Both layer sets provide `underPieces`, `pieces`, `effects`, and `overlay`, in that order:

- `surface.layers`: viewport-pixel coordinates, for the existing mode renderers and screen-sized effects. Use `cellToScreen` or `metrics` to position content.
- `surface.worldLayers`: cell coordinates (one unit = one cell), with automatic pan/zoom/fit transforms. Suitable for new custom world content.

```ts
const highlight = new Graphics()
  .rect(column, row, 1, 1)
  .stroke({ color: 0xffffff, width: 0.05 })
surface.worldLayers.overlay.addChild(highlight)

const stop = surface.onFrame((deltaMs) => {
  // Update mode-specific effects on the application's existing ticker.
})
surface.onDispose(() => {
  // Kill custom tweens or destroy custom filters here.
})
```

These are ordinary Pixi containers: modes can add Graphics, sprites, text, filters and their own nested containers. Selection handles, focus outlines, landing previews and lock effects are mode-owned. Temporary tile sprites can animate individual background cells over the tiled grid.

`surface.destroy()` runs registered cleanups, removes its containers and releases its generated texture. It does not destroy the mode's Pixi application. Effects should target a separate container from camera transforms.

## Input callbacks

```ts
const detach = attachGridInput(app.canvas, {
  cellAt: (event) => surface.pointerToCell(event),
  enabled: () => !paused,
  threshold: 36,
  horizontalSteps: true,
  callbacks: {
    onCellTap: ({ column, row }) => selectCell(column, row),
    onSwipeLeft: ({ steps }) => movePiece(-steps),
    onSwipeRight: ({ steps }) => movePiece(steps),
    onSwipeDown: () => dropPiece(),
  },
})
surface.onDispose(detach)
```

Swipe callbacks receive normalized cell coordinates, the original pointer event, and a step count. Multitouch, cancelled gestures and completed drags do not also produce taps. `gestures: false` delegates gesture ownership to raw pointer callbacks; Sandbox uses this for selection handles, move previews, panning and pinch zoom. This avoids competing gesture recognizers for the same pointer.
