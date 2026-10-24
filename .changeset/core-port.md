<!-- biome-ignore-all format: Preserve Changesets YAML frontmatter. -->
---
"@segnomusic/player": minor
---

The core, `@segnomusic/player/core`: `buildSync()` turns MuseScore's bar and note position files (`.mpos`, `.spos`) and the SVG pages' sizes into a sync map (format version 1), and `createTimeline()` answers what plays when: the bar and how far into it, the note cursor, the bar under a click, and where to seek to play a bar inside repeats.
