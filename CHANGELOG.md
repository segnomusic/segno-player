# @segnomusic/player

## 0.3.1

### Patch Changes

- 9be095c: Export `SegnoPlayerAttributes`, the type of `<segno-player>`'s attributes, and document how to register the tag with React, Vue, Svelte and Angular in the README.

## 0.3.0

### Minor Changes

- fc6717f: **Breaking change (0.3.0):** move the component entry point to the package root, `@segnomusic/player`, and remove `@segnomusic/player/player` without a compatibility alias. Replace `import '@segnomusic/player/player'` with `import '@segnomusic/player'`, and `await import('@segnomusic/player/player')` with `await import('@segnomusic/player')`. Named and type-only imports also use the root, for example `import { SegnoPlayer, type ScoreMode } from '@segnomusic/player'`. See the README's migration section for before/after examples. `@segnomusic/player/core`, the custom element and its API, lazy loading, SSR-safe imports, and the explicit CDN file URL (`dist/player/index.js`) are unchanged.

## 0.2.1

### Patch Changes

- 8547f81: Match Zoom and Reflow magnification to the engraved staff size across scores, prevent wide bar groups from shrinking notation, and keep each system's lyrics visible in cropped and recombined views.

## 0.2.0

### Minor Changes

- 9ac91b6: Add Swedish and English localization for player controls, score descriptions, and screen-reader announcements. Use standard HTML `lang` inheritance with English fallback, and update translations in place without interrupting playback.

## 0.1.0

### Minor Changes

- 160ed0c: Add opt-in two-system and reflow canvas score views for narrow screens, with lazy multi-page rasters and the existing themed playback overlays. Add a reflected `mode` property, read-only `resolvedMode`, `modechange` events, a built-in layout selector, and container-based `auto` selection. Full engraved pages remain the default and the fallback.
- 7ac3662: The core, `@segnomusic/player/core`: `buildSync()` turns MuseScore's bar and note position files (`.mpos`, `.spos`) and the SVG pages' sizes into a sync map (format version 1), and `createTimeline()` answers what plays when: the bar and how far into it, the note cursor, the bar under a click, and where to seek to play a bar inside repeats.
- 17b053a: Give the built-in player a dark, themeable control bar with back to beginning, tempo buttons and a follow checkbox. On narrow players, tempo and follow collapse behind a settings button. Add a boolean `follow` property and a `followchange` event so controls stay in sync with the attribute.
- c4e83f9: `<segno-player>` (`@segnomusic/player/player`): plays a score's audio on its SVG pages with a bar marker and a note cursor. Its playback API follows `HTMLMediaElement`, it has optional built-in controls, and it can be themed with `--segno-*` custom properties, parts and container queries. When the files don't fit together it plays without markers and says why.

### Patch Changes

- 160ed0c: Set the default bar-marker lead to +15 ms and the note-cursor lead to −20 ms.
- 1fe8ae8: Rebuild compiled modules when packing the package so releases cannot accidentally ship stale build output.
- 6177047: Use `@segnomusic/player` as the package name and update repository and demo links for the move to `segnomusic/segno-player`.
