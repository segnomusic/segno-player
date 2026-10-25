<!-- biome-ignore-all format: Preserve Changesets YAML frontmatter. -->
---
"@segnomusic/player": minor
---

**Breaking change (0.3.0):** move the component entry point to the package root, `@segnomusic/player`, and remove `@segnomusic/player/player` without a compatibility alias. Replace `import '@segnomusic/player/player'` with `import '@segnomusic/player'`, and `await import('@segnomusic/player/player')` with `await import('@segnomusic/player')`. Named and type-only imports also use the root, for example `import { SegnoPlayer, type ScoreMode } from '@segnomusic/player'`. See the README's migration section for before/after examples. `@segnomusic/player/core`, the custom element and its API, lazy loading, SSR-safe imports, and the explicit CDN file URL (`dist/player/index.js`) are unchanged.
