# Roadmap

Where Segno is heading. This is a statement of intent, not a promise: items can change, move or be dropped. Settled choices are recorded in the [decision log](decisions/INDEX.md); anything marked **open** below has no decision yet.

Segno's scope is set by [DL-001](decisions/records/DL-001.md): it plays a score's own audio on its own engraved pages. It doesn't render, edit, transpose or convert scores, and the roadmap is built around that.

## Toward 1.0

- **Stabilise the API.** The core library and `<segno-player>` work and are tested, but their APIs may still change. Reaching 1.0 means freezing the element's attributes, properties and events, and the sync map format ([DL-003](decisions/records/DL-003.md)).
- **`segno build-sync`.** A CLI that builds sync maps ahead of time (at build time, in Node), so sites don't parse MuseScore's position files in the browser.
- **More player languages.** English and Swedish are built in ([DL-027](decisions/records/DL-027.md)). Further languages must satisfy the same typed dictionary schema.

## Later

- **Other engravers.** MuseScore's position files are the only input today ([DL-002](decisions/records/DL-002.md)). Another engraver can be supported by producing a sync map from its own data, without changing the player.
- **Single-file bundle.** An optional alternative to the plain ES modules for sites that want one file ([DL-018](decisions/records/DL-018.md)). It would not replace the modules.

## Open: playing a score in another key or at another tempo

**Goal.** Let a listener change the key (transpose) and the tempo of a score without degrading the sound, and with the pages and markers still in step with what they hear.

**Where things stand.** Tempo already works: `playbackRate` time-stretches the recorded audio with pitch preserved. It degrades quickly: around 80–90% is acceptable, but below that artifacts and intonation problems appear, particularly on sustained and vocal material. There is no transposition. The audio is a recording, so shifting its pitch degrades it, and the engraved pages are fixed images, so transposed sound would no longer match the notation on screen.

**How is undecided.** The approaches below are the ones considered so far. None is chosen, and they aren't mutually exclusive.
1. **A sibling conversion service, with Segno itself unchanged.** A separate project takes a score (for example MusicXML), transposes it, and returns everything the player needs: new SVG pages, the position files or a ready-made sync map, and new audio. Segno keeps playing a recording on engraved pages and stays free of any synthesizer. This also fits what DL-001 already allows ("a hosted converter may become a separate project later"), as long as Segno never depends on it. The questions are who hosts it, how it runs MuseScore on the server, and the licensing of the sounds it uses.
2. **Synthesised playback inside Segno**, optionally. The player would drive a third-party synthesizer from a MIDI file instead of an `<audio>` element. That would give clean tempo changes and cheap muting of parts, but it needs an amendment to DL-001, an engine abstraction in the player, a lazy-loaded optional entry point to respect the size budget, and a check that MuseScore's MIDI timing matches its position files. Sound quality would also fall short of MuseScore's own audio. Transposed sound would still disagree with the fixed pages unless the pages were transposed as well.
3. **Pre-rendered variants.** The publisher exports the score in the keys and tempos they want to offer, and the player switches between ready-made sets of files. It needs no new machinery in Segno beyond choosing which files to load, but it multiplies the files to host.

**Related, and possibly separate: part muting.** MuseScore can export audio per part. Several synced audio tracks would let a listener mute or solo parts at full MuseScore quality, with the sync map unchanged, because the tracks share one timeline. This doesn't need a synthesizer.

**To decide.** Which of these is worth building first, whether any of them belongs in this repository, and what the first user need is: part muting, better slow playback, or a different key. A decision record (`dld-decide`) will follow once one approach is chosen. Nothing here should be built before that.
