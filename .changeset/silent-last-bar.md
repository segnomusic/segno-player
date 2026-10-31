<!-- biome-ignore-all format: Preserve Changesets YAML frontmatter. -->
---
"@segnomusic/player": patch
---

Keep the markers when only a silent last bar starts after the audio's end, for example a final bar of rests, or synthesized audio that stops at the last sound. The player now plays without markers only when the audio ends before the second-to-last bar starts, which is still what audio exported with "Play repeats" off looks like. The last bar is marked when the audio ends, and `playBar()` on it seeks to the end.
