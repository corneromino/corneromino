# Nokomino

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
configuration. Renaming the repository to `nokomino` therefore produces the new
asset paths automatically. The manifest's start URL, scope and icons are relative
to the deployed directory, supporting both `/nokomino/` and root hosting.

The release version is maintained in `public/manifest.json`; Vite embeds it in
the app and the generated `sw.js` cache name. `npm run release -- patch` increments
that version, commits it and pushes it. Use `minor` or `major` for larger releases.

## Existing installations and saved games

On first launch, Nokomino imports the old `corneromino` IndexedDB database into
`nokomino` before exposing storage to the app. This includes all Classic saves,
Cascade state and best score, Local VS state and full move history, and Sandbox
worlds with their screenshots. The old database is retained as a backup. Import
completion is committed with the data so failures can retry and deleted games
are not restored on later launches. Newer destination records take precedence;
the Cascade best score keeps the higher value.

Legacy difficulty IDs and renamed save fields are normalized during import;
seeds, user-authored names, screenshots and timestamps are preserved. The saved
language preference is copied to `nokomino:language`. Old names remaining in the
source are intentional compatibility identifiers and migration fixtures.

Browser storage is shared across paths on the **same origin**, so a repository
path change preserves migration access. Moving to a different domain requires a
separate data transfer. The new PWA identity may require reinstalling an existing
home-screen shortcut; redirects for the old deployment URL are managed by the host.
