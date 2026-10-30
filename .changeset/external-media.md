<!-- biome-ignore-all format: Preserve Changesets YAML frontmatter. -->
---
"@segnomusic/player": minor
---

Let a host play the score through its own engine, for example a synthesizer playing MuseScore's MIDI, by setting `player.media` to an object shaped like a media element (the exported `SegnoMedia` type). Setting it while playing keeps the position, the tempo and the playing state, and `media = null` returns to the `audio` file. Add `tempo-min`, `tempo-max` and `tempo-step` (percent, defaults 50, 150 and 10) for the tempo buttons' range, and `tempo-base` to show the tempo as "♩ = N". With the built-in audio, `playbackRate` is now kept within 0.25–2, which every browser can play, and the pitch is also kept on iOS before 17.2.
