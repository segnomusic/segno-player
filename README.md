# <img src="docs/logo.svg" alt="Segno" height="54" />

<!-- @decision(DL-021) @decision(DL-025) -->

Play a score's own audio on its own engraved pages, and follow along: a marker on the bar being played and a thin cursor that flows from note to note. Built for MuseScore exports.

[![Segno player showing a bar marker, note cursor and playback controls on När juldagsmorgon glimmar](docs/preview.png)](https://segnomusic.github.io/segno-player/)

Web notation libraries draw the score themselves from MusicXML or similar, reflowing it to the screen, which can make a carefully engraved score harder to read. Where they offer playback, it is usually synthesized, or a recording aligned by hand. Segno keeps the pages the engraver set and plays a real recording without manual alignment: MuseScore already exports the position and time of every bar and note in playback order, so Segno never interprets the score itself.

> **Status: early.** The core library (`@segnomusic/player/core`) and the `<segno-player>` web component work and are tested; their APIs may still change before 1.0. Try the bundled example or your own export on the [demo page](https://segnomusic.github.io/segno-player/).

## What's in the box

- **`@segnomusic/player/core`**: a dependency-free library that turns MuseScore's position files into a small _sync map_ and answers "what plays at time t". It has no DOM, so it runs in Node (at build time) and in the browser.
- **`@segnomusic/player`**: the `<segno-player>` web component that shows the SVG pages, plays the audio and draws the markers. It works on any site, and its API follows the `<audio>` element.
- **`segno build-sync`** _(coming)_: a CLI to build sync maps ahead of time.

Segno does not render, edit, transpose or convert scores.

## Exporting from MuseScore

One MuseScore conversion job writes everything Segno needs from a single score: the audio, one SVG per page, the bar positions (`.mpos`) and, for the note cursor, the note positions (`.spos`).

```sh
echo '[{"in": "song.mscz", "out": ["song.mp3", "song.svg", "song.mpos", "song.spos"]}]' > job.json
mscore -j job.json   # song.mp3, song-1.svg, song-2.svg, …, song.mpos, song.spos
```

(`mscore` stands for MuseScore's executable; its name and path depend on the platform and how MuseScore was installed.)

The files only belong together when they come from the same score and the same settings. Watch for these:
- **Turn "Play repeats" on** in MuseScore's preferences before exporting (it is on by default). The audio follows that setting, but the position files always unroll the repeats. If the audio ends before the last bar's start time, the two don't match, and `<segno-player>` plays without markers and warns.
- **Leave the PNG resolution at its default**, and don't pass `-r`. The position files are in SVG units × 12 only at the default resolution. If a bar falls outside its page, the files don't belong together, and `buildSync()` throws.
- **Export everything from the same MuseScore version, in one job.** MuseScore 4.6.2 and 4.7 write SVG pages at different scales (an A4 page is 2976 × 4209 units in one and 9921 × 14031 in the other), so pages from one version don't fit positions from another.
- **Export the MP3 first in a job.** MuseScore 4.6 can fail the audio export when it follows an image export.
- **One input score per job.** Jobs with several input files crash MuseScore 4.7.5.
- **Headless Linux:** run the AppImage under `xvfb-run`. Its `offscreen` Qt platform plugin did not start in testing.

What was verified, with MuseScore 4.7.5 (Linux build, headless):
- Repeats, voltas, D.C./D.S., codas and fine come out in playback order: the position writer walks MuseScore's own unrolled repeat list. All 69 scores of MuseScore's repeat test suite (`src/engraving/tests/repeat_data`) matched the expected bar order.
- Times follow MuseScore's tempo map, ritardandos included.
- The exported MP3 sounds a constant ~60 ms after the event times (synthesizer latency), with no drift, measured with onset detection against a click track over a 108 s score with repeats and a ritardando.

## Using the player

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@segnomusic/player/dist/player/index.js"></script>

<segno-player
  pages="song-1.svg song-2.svg"
  audio="song.mp3"
  positions="song.mpos"
  notes="song.spos"
  alt="När juldagsmorgon glimmar"
  controls
  follow>
</segno-player>
```

<!-- @decision(DL-032) -->

With a bundler, `import '@segnomusic/player'` defines the element. Named exports and types come from the same entry point:

```ts
import { SegnoPlayer, type BarChangeDetail, type ScoreMode } from '@segnomusic/player';
```

For lazy loading, use `await import('@segnomusic/player')` when the player is needed. The modules are plain ES modules, so a CDN serves them as they are. Importing them where there is no DOM (server rendering) is harmless: the element is only defined in the browser.

### Migrating to 0.3.0

**Breaking change:** the `@segnomusic/player/player` subpath has been removed, without a compatibility alias. Replace it with the package root in static, dynamic, and type-only imports:

```diff
- import '@segnomusic/player/player';
+ import '@segnomusic/player';

- await import('@segnomusic/player/player');
+ await import('@segnomusic/player');

- import type { SegnoPlayer } from '@segnomusic/player/player';
+ import type { SegnoPlayer } from '@segnomusic/player';
```

`@segnomusic/player/core`, the `<segno-player>` element and its API, and the explicit CDN URL above are unchanged.

### Player API

The player takes the width it is given: in a layout that sizes elements to their content (an inline block, a flex row), give it a width or `flex: 1`.

| Attribute                                |                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pages`                                  | The SVG pages' URLs, in page order, separated by spaces                                         |
| `audio`                                  | The audio's URL                                                                                 |
| `positions`, `notes`                     | The `.mpos` and (optional, for the note cursor) `.spos` files' URLs                             |
| `sync`                                   | A prebuilt sync map's URL, instead of `positions` and `notes` (or set the `sync` property)      |
| `controls`                               | Show playback, tempo, score-layout and follow controls                                          |
| `mode`                                   | `full` (default), `two-system`, `reflow`, or `auto`                                             |
| `follow`                                 | Scroll the playing system into view when it leaves the screen in full-score mode                |
| `alt`                                    | The score's title, for the pages' alt text                                                      |
| `lang`                                   | Player language (`en` or `sv`); inherited from the surrounding page when omitted                |
| `bar-lead`, `note-lead`                  | Timing offsets in ms for the bar marker and note cursor (default 15 and −20; positive is early) |
| `note-cursor="off"`, `bar-change="jump"` | No note cursor; switch bars at once instead of crossfading                                      |

The playback API follows `HTMLMediaElement`: `play()`, `pause()`, `currentTime` (seconds), `duration`, `playbackRate` (pitch preserved), `paused`, `error`, and the events `play`, `pause`, `playing`, `waiting`, `seeking`, `seeked`, `timeupdate`, `ratechange`, `durationchange`, `loadedmetadata`, `emptied`, `ended`, `error` and `canplay` (once the audio can play and the markers are ready). On top of that: `currentBar`, `playBar(index)` and the `barchange` event (`detail: { bar, event }`). `sync` holds the sync map in use, or `null` while there are no markers.

The `mode` property reflects the `mode` attribute; `resolvedMode` reports the view on screen, and `modechange` reports both as `detail: { mode, resolvedMode }`. Full score is always the default. Two-system mode crops the original engraving around pairs of systems; reflow recombines whole engraved bar regions into two prepared rows without moving individual symbols. `auto` chooses full score at a player width of 768px or more and two-system below it. The built-in layout selector and external code share the same property, so the latest selection wins. Canvas assets load on demand and fall back to full pages if they cannot be rendered.

The built-in tempo buttons adjust playback from 50–150% in steps of 10%. Back to beginning pauses and resets the score. On narrow players, a settings button reveals the score-layout selector, tempo and the "Follow score" checkbox below the playback controls. The boolean `follow` property reflects the `follow` attribute; `followchange` fires when it is switched, including by the checkbox. Following scrolls the score; turning it off leaves the markers running.

Clicking a bar plays from it. On the focused score, Space or K plays and pauses, ← and → move between bars, and Home goes to the start.

If the files don't fit together, the player still shows the pages and plays the audio, without markers, and says why in the console.

Theme it with `--segno-*` custom properties, `::part()` and container queries: see [docs/theming.md](docs/theming.md).

### Language

<!-- @decision(DL-028) @decision(DL-029) -->

The built-in controls and screen-reader descriptions support **English (`en`)** and **Swedish (`sv`)**. Use standard HTML `lang` on the player or let it inherit from its surroundings:

```html
<html lang="sv">
  <!-- Players on this page use Swedish unless they override lang. -->
  <segno-player pages="song-1.svg" audio="song.mp3" positions="song.mpos" controls></segno-player>
  <segno-player lang="en" pages="song-1.svg" audio="song.mp3" positions="song.mpos" controls></segno-player>
</html>
```

Regional tags such as `sv-SE` use their base language. Unsupported, unspecified, or explicitly empty languages fall back to English. The nearest `lang` wins; `lang=""` stops inheritance rather than selecting a Swedish ancestor. Browser language preferences are not used.

Changing `player.lang`, its `lang` attribute, or an inherited ancestor language updates the existing controls and descriptions without restarting playback or losing focus, settings, or position. Score titles supplied through `alt` and any custom slotted controls are left unchanged. Developer-facing errors and console warnings remain in English.

## Using the core

```sh
npm install @segnomusic/player
```

```js
import { buildSync, createTimeline, readViewBox } from '@segnomusic/player/core';

// The SVG pages' sizes, in page order
const pages = svgTexts.map(readViewBox);
const sync = buildSync(mposXml, pages, { sposXml }); // sposXml is optional: it adds the note cursor

const timeline = createTimeline(sync);
const now = timeline.at(audio.currentTime * 1000, audio.duration * 1000);
// { event, bar, page, box: [x, y, w, h], progress, note: { page, x, y, h } | null }
// Positions are fractions of the page (0–1), so they work at any display size.

timeline.noteAt(ms, endMs); // the note cursor alone
timeline.barAtPoint(page, fx, fy); // the bar under a click, or -1
timeline.seekTimeForBar(bar, nowMs); // where to seek to play a bar: inside repeats, the pass nearest nowMs
```

`buildSync()` throws when a file isn't a positions file, a bar is on a page that wasn't given, a box falls outside its page (the units or the pages don't match), an event names an unknown element, or the times go backwards. The sync map is plain JSON, so it can be built at build time and shipped with the page. Its format is documented in [docs/sync-map.md](docs/sync-map.md).

The ~60 ms latency above, and whatever the listener's audio device adds (Bluetooth adds a lot), means markers that arrive exactly on the event time can feel late. The player's `bar-lead` and `note-lead` attributes move its markers early; with the core alone, look up a little ahead of `currentTime`.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the setup, the checks, and how design decisions are recorded in [`decisions/`](decisions/INDEX.md).

## Licence

Segno is open source under the [MIT License](LICENSE).

"MuseScore" is a trademark of its owners; Segno is not affiliated with MuseScore. Test scores are listed with their sources and licences in [fixtures/SOURCES.md](fixtures/SOURCES.md).
