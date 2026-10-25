# <img src="docs/logo.svg" alt="Segno" height="54" />

<!-- @decision(DL-021) @decision(DL-025) -->

Play a score's own audio on its own engraved pages, and follow along: a marker on the bar being played and a thin cursor that flows from note to note. Built for MuseScore exports.

[![Segno player showing a bar marker, note cursor and playback controls on När juldagsmorgon glimmar](docs/preview.png)](https://segnomusic.github.io/segno-player/)

> **Status: early.** The core library (`@segnomusic/player/core`) and the `<segno-player>` web component work and are tested; their APIs may still change before 1.0. Try the bundled example or your own export on the [demo page](https://segnomusic.github.io/segno-player/).

## Why Segno?

Most web notation libraries, [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/) and [Verovio](https://www.verovio.org/) for example, draw the score themselves from MusicXML or similar, and reflow it to fit your screen. That is a great fit for practice and education apps. But how well it works depends on the score. Busy piano parts and choral works can get cluttered, and **intentional layout decisions get lost**. Where those libraries offer playback, it is usually synthesized.

Segno goes the other way. It keeps the pages exactly as the engraver set them, and plays a time-synced recording over them. That works because MuseScore already exports the position and time of every bar and note, in playback order, so Segno never has to interpret the score itself.

It is a slightly ambivalent player, though. Full pages are the default, but for small screens it also offers two hybrid views, Zoom and Reflow, that trade some of the original layout for readability. See [Display modes](#display-modes).

## What's in the box

- **`@segnomusic/player/core`**: a dependency-free library that turns MuseScore's position files into a small _sync map_ and answers "what plays at time t". It has no DOM, so it runs in Node (at build time) and in the browser.
- **`@segnomusic/player`**: the `<segno-player>` web component that shows the SVG pages, plays the audio and draws the markers. It works on any site, and its API follows the `<audio>` element.
- **`segno build-sync`** _(coming)_: a CLI to build sync maps ahead of time.

Segno does not render, edit, transpose or convert scores.

## Using the player

Add the script and point the element at your files:

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

That is all it takes. `pages` are the score's SVG pages in order, `audio` is the recording, and `positions` and `notes` are the bar and note position files. `notes` is optional: leave it out and you get the bar marker without the note cursor. `controls` shows the playback controls and `follow` scrolls the score along as it plays.

If you don't have these files yet, the next two sections explain [the display modes](#display-modes) and [how to export everything from MuseScore](#exporting-from-musescore) in one go.

<!-- @decision(DL-032) -->

With a bundler, `import '@segnomusic/player'` defines the element. Named exports and types come from the same entry point:

```ts
import { SegnoPlayer, type BarChangeDetail, type ScoreMode } from '@segnomusic/player';
```

For lazy loading, use `await import('@segnomusic/player')` when the player is needed. The modules are plain ES modules, so a CDN serves them as they are. Importing them where there is no DOM (server rendering) is harmless: the element is only defined in the browser.

If the markers feel slightly early or late on your setup, the `bar-lead` and `note-lead` attributes let you tweak the timing. See the [player API](#player-api).

### Display modes

The `mode` attribute (or the layout selector in the built-in controls) picks how the score is shown:
- **Full score** (`full`, the default): the complete engraved pages, exactly as exported. Also the fallback if the other views can't be rendered.
- **Zoom** (`two-system`): crops the original engraving around two systems at a time, a few bars wide, and scrolls along as the score plays. It is still the original notation, just closer.
- **Reflow** (`reflow`): it is not entirely honest to call this reflow. What it does is cut the score up bar by bar and lay the pieces out in two rows. More bars fit on screen than in Zoom, but the layout can be less pleasing and the cropping can leave artifacts, such as a volta bracket separated from its bars.
- **Auto** (`auto`): full score when the player is 768 px wide or more, Zoom below that.

Full score is always the default; the other views are opt-in.

### Frameworks and TypeScript

<!-- @decision(DL-005) @decision(DL-033) -->

`<segno-player>` is a plain custom element, so it works in any framework once the module is imported on the client. The package exports `SegnoPlayerAttributes`, the type of its attributes, and `HTMLElementTagNameMap` already knows the element, so `document.querySelector('segno-player')` and `addEventListener('barchange', …)` are typed. JSX and templates need to be told about the tag. These snippets were checked against current React 19, Vue 3 and Svelte 5 types; put them in a `.d.ts` or `.ts` file your project includes.

React (use a ref for `play()` and for listening to `barchange`):

```ts
import type { SegnoPlayer, SegnoPlayerAttributes } from '@segnomusic/player';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'segno-player': DetailedHTMLProps<HTMLAttributes<SegnoPlayer>, SegnoPlayer> & SegnoPlayerAttributes;
    }
  }
}
```

Vue (also set `compilerOptions.isCustomElement: (tag) => tag === 'segno-player'` in the Vue plugin options):

```ts
import type { SegnoPlayerAttributes } from '@segnomusic/player';
import type { DefineComponent } from 'vue';

declare module 'vue' {
  interface GlobalComponents {
    'segno-player': DefineComponent<SegnoPlayerAttributes>;
  }
}
```

Svelte:

```ts
import type { SegnoPlayer, SegnoPlayerAttributes } from '@segnomusic/player';
import type { HTMLAttributes } from 'svelte/elements';

declare module 'svelte/elements' {
  interface SvelteHTMLElements {
    'segno-player': HTMLAttributes<SegnoPlayer> & SegnoPlayerAttributes;
  }
}
```

Angular needs no types, only `CUSTOM_ELEMENTS_SCHEMA` on the component or module that uses the tag.

## Exporting from MuseScore

Segno needs a handful of files from your score:

| File                          | What it is                                                | Needed for                 |
| ----------------------------- | --------------------------------------------------------- | -------------------------- |
| `song.mp3`                    | The audio                                                 | Playback                   |
| `song-1.svg`, `song-2.svg`, … | One image per page of the score                           | The pages Segno shows      |
| `song.mpos`                   | Where each bar is on its page, and when it starts playing | The bar marker             |
| `song.spos`                   | The same, for each note                                   | The note cursor (optional) |

MuseScore can write all of them from a single conversion job, using its command line mode. If you have never used that: it is the same MuseScore you already have, started from a terminal with a small file that says what to convert. There is no extra software to install.

### 1. Find the MuseScore executable

The path depends on your platform and how MuseScore was installed. Typical locations for MuseScore 4:

| Platform | Executable                                            |
| -------- | ----------------------------------------------------- |
| Windows  | `C:\Program Files\MuseScore 4\bin\MuseScore4.exe`     |
| macOS    | `/Applications/MuseScore 4.app/Contents/MacOS/mscore` |
| Linux    | `mscore`, or the path to the AppImage file            |

In the examples below, `mscore` stands for whichever of these you use. Put the path in quotes if it contains spaces.

### 2. Write a job file

Create a file called `job.json` next to your score:

```json
[
  {
    "in": "song.mscz",
    "out": ["song.mp3", "song.svg", "song.mpos", "song.spos"]
  }
]
```

`in` is the score and `out` lists the files to create. MuseScore picks each format from the file extension. Two details matter here: the **MP3 goes first**, and a job has **one score only**. If you don't want the note cursor, leave `song.spos` out. The score can also be a MusicXML file instead of a `.mscz`; MuseScore imports it as it loads it.

### 3. Run it

Run MuseScore from the folder that contains `job.json` and the score:

```sh
mscore -j job.json
```

When it finishes you have `song.mp3`, `song.mpos`, `song.spos` and one SVG per page, named `song-1.svg`, `song-2.svg` and so on. Those are exactly the files from the [player example](#using-the-player).

On Windows, `MuseScore4.exe` is a GUI program, so a terminal can return before the export is done. In a script, wait for it with `start /wait "" "C:\Program Files\MuseScore 4\bin\MuseScore4.exe" -j job.json`.

### 4. Try it

Put the files next to a page with the player on it, or try them on the [demo page](https://segnomusic.github.io/segno-player/). If the files don't fit together, the player still shows the pages and plays the audio, just without markers, and says why in the browser console.

### When the files don't line up

The files only belong together when they come from the same score and the same settings. These are the things to watch for:
- **Turn "Play repeats" on** in MuseScore's preferences before exporting (it is on by default). The audio follows that setting, but the position files always unroll the repeats. If the audio ends before the last bar's start time, the two don't match, and `<segno-player>` plays without markers and warns.
- **Leave the PNG resolution at its default**, and don't pass `-r`. The position files are in SVG units × 12 only at the default resolution. If a bar falls outside its page, the files don't belong together, and `buildSync()` throws.
- **Export everything from the same MuseScore version, in one job.** MuseScore 4.6.2 and 4.7 write SVG pages at different scales (an A4 page is 2976 × 4209 units in one and 9921 × 14031 in the other), so pages from one version don't fit positions from another.
- **Export the MP3 first in a job.** MuseScore 4.6 can fail the audio export when it follows an image export.
- **One input score per job.** Jobs with several input files crash MuseScore 4.7.5.
- **Headless Linux:** run the AppImage under `xvfb-run`. Its `offscreen` Qt platform plugin did not start in testing.

## Player reference

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

## Using the core

If you want to build your own player, or build sync maps at build time, the core does the heavy lifting without any DOM:

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

`buildSync()` throws when a file isn't a positions file, a bar is on a page that wasn't given, a box falls outside its page (the units or the pages don't match), an event names an unknown element, or the times go backwards. The sync map is plain JSON, so it can be built at build time and shipped with the page. Its format is documented in [docs/sync-map.md](docs/sync-map.md), and nothing says it has to come from MuseScore: anything that can produce bar positions and timings can write one.

MuseScore's audio sounds slightly after the event times (synthesizer latency), and the listener's audio device adds its own delay on top (Bluetooth adds a lot). Markers that arrive exactly on the event time can therefore feel late. The player's `bar-lead` and `note-lead` attributes move its markers early; with the core alone, look up a little ahead of `currentTime`.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the setup, the checks, and how design decisions are recorded in [`decisions/`](decisions/INDEX.md).

## Licence

Segno is open source under the [MIT License](LICENSE).

"MuseScore" is a trademark of its owners; Segno is not affiliated with MuseScore. Test scores are listed with their sources and licences in [fixtures/SOURCES.md](fixtures/SOURCES.md).
