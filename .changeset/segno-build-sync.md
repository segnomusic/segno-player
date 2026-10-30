<!-- biome-ignore-all format: Preserve Changesets YAML frontmatter. -->
---
"@segnomusic/player": minor
---

Add the `segno` command line, with `segno build-sync`, which builds a score's sync map ahead of time from its MuseScore export: `npx @segnomusic/player build-sync song` reads `song.mpos`, `song.spos` and `song-1.svg`, `song-2.svg`, … and writes `song.sync.json` for `<segno-player sync="…">`. Sync maps now carry their pages' sizes (an optional `pages` field, still format version 1), so a player given a prebuilt map keeps each page's shape before its image loads, and rejects a map built for a different number of pages.
