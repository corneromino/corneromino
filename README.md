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

## Existing installations and saved games

The permanent database name is `game-data`, independent of the displayed brand.
On first launch, the app imports the previous database before exposing storage
to the app. It also imports the original database if that earlier migration
never completed. A completed import makes the previous database authoritative,
so deleted saves and worlds are not resurrected from the older backup.
This includes all Classic saves,
Cascade state and best score, Local VS state and full move history, and Sandbox
worlds with their screenshots. The old databases are retained as backups. Import
completion is committed with the data so failures can retry and deleted games
are not restored on later launches. Newer destination records take precedence;
the Cascade best score keeps the higher value.

Legacy difficulty IDs and renamed save fields are normalized during import;
seeds, user-authored names, screenshots and timestamps are preserved. The saved
language preference is copied to `game:language`. Old names remaining in the
source are intentional compatibility identifiers. Historical formats used by
tests are isolated in `src/lib/__fixtures__/legacyStorage.ts`.

Browser storage is shared across paths on the **same origin**, so a repository
path change preserves migration access. Moving to a different domain requires a
separate data transfer. The new PWA identity may require reinstalling an existing
home-screen shortcut; redirects for the old deployment URL are managed by the host.

## Branding and stable identifiers

Set the display name and short name in `public/manifest.json`. The HTML title,
menu headings and translated shape terminology derive from that metadata via
`src/lib/branding.ts`. Package names are release-facing metadata.
Assets use neutral `app-logo.svg` and `app-icon*.png` filenames.

Gameplay uses cells, pieces and shapes: Local VS stores `placedCells` and
`lockedShapes`; Cascade stores `lockedShapeCount`. Keep `game-data`,
`game:language`, `game-shell-`, `game-debug` and the manifest's `game-pwa-v1`
identity stable across future branding changes. Schema migrations are only
needed when the saved-data structure changes, not when the display name changes.
