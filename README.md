# Tetromino puzzle game

A tetromino deduction game built with React, TypeScript, PixiJS and Vite. Includes
Classic puzzles, Infinite, Cascade, Local VS and a Sandbox editor. The interface
supports English and French, and the app can be installed as a PWA.

## Development

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
npm run lint
npm test
```

## Deployment

The GitHub Pages workflow derives `VITE_BASE_PATH` from the repository's Pages
configuration, so repository renames produce the new asset paths automatically.
The manifest's start URL, scope and icons are relative to the deployed directory,
supporting both repository-subdirectory and root hosting.

The release version is maintained in `public/manifest.json`; Vite embeds it in
the app and the generated `sw.js` cache name. `npm run release -- patch` increments
that version, commits it and pushes it. Use `minor` or `major` for larger releases.

## Storage and seeds

The permanent database name is `game-data`, independent of the displayed brand.
The app reads and writes the current save format directly. Language preferences
use `game:language`. Classic generation uses `${gameMode}:${seedKey}` literally,
for example `c003:seed-key`, with no difficulty-prefix translation.

## Branding and stable identifiers

Set application branding in `src/lib/branding.ts` and the matching display name
and short name in `public/manifest.json`. Package names are release-facing metadata.
Assets use neutral `app-logo.svg` and `app-icon*.png` filenames.

Gameplay uses cells, pieces and shapes: Local VS stores `placedCells` and
`lockedShapes`; Cascade stores `lockedShapeCount`. Keep `game-data`,
`game:language`, `game-shell-`, `game-debug` and the manifest's `game-pwa-v1`
identity stable across future branding changes. Schema migrations are only
needed when the saved-data structure changes, not when the display name changes.
