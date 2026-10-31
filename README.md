# <img src="docs/logo.svg" alt="Segno" height="54" />

<!-- @decision(DL-021) @decision(DL-025) -->

Play a score's own audio on its own engraved pages, and follow along: a marker on the bar being played and a thin cursor that flows from note to note. Built for MuseScore exports.

[![Segno player showing a bar marker, note cursor and playback controls on När juldagsmorgon glimmar](docs/preview.png)](https://segnomusic.github.io/segno-player/)

> **Status: early.** The core library (`@segnomusic/player/core`) and the `<segno-player>` web component work and are tested; their APIs may still change before 1.0. Try the bundled example or your own export on the [demo page](https://segnomusic.github.io/segno-player/). See the [roadmap](ROADMAP.md) for what's planned.

## Why Segno?

Most web notation libraries, [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/) and [Verovio](https://www.verovio.org/) for example, draw the score themselves from MusicXML or similar, and reflow it to fit your screen. That is a great fit for practice and education apps. But how well it works depends on the score. Busy piano parts and choral works can get cluttered, and **intentional layout decisions get lost**. Where those libraries offer playback, it is usually synthesized.

Segno goes the other way. It keeps the pages exactly as the engraver set them, and plays a time-synced recording over them. That works because MuseScore already exports the position and time of every bar and note, in playback order, so Segno never has to interpret the score itself.

It is a slightly ambivalent player, though. Full pages are the default, but for small screens it also offers two hybrid views, Zoom and Reflow, that trade some of the original layout for readability. See [Display modes](#display-modes).

## What's in the box

- **`@segnomusic/player/core`**: a dependency-free library that turns MuseScore's position files into a small _sync map_ and answers "what plays at time t". It has no DOM, so it runs in Node (at build time) and in the browser.
- **`@segnomusic/player`**: the `<segno-player>` web component that shows the SVG pages, plays the audio and draws the markers. It works on any site, and its API follows the `<audio>` element.
- **`segno build-sync`**: a command that builds the sync map ahead of time, so the browser doesn't have to. See [Prebuild the sync map](#5-prebuild-the-sync-map-optional).

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

### 5. Prebuild the sync map (optional)

<!-- @decision(DL-035) -->

The player can read the position files and the SVG pages itself, as above. If your site has a build step, you can do that work once instead, and give the player a single small JSON file, the _sync map_:

```sh
npx @segnomusic/player build-sync song
```

This reads `song.mpos`, `song.spos` (when there is one) and the pages `song-1.svg`, `song-2.svg`, …, and writes `song.sync.json`. Then point the player at it in place of `positions` and `notes`:

```html
<segno-player pages="song-1.svg song-2.svg" audio="song.mp3" sync="song.sync.json" controls></segno-player>
```

With `@segnomusic/player` installed in your project, the command is also available as `segno build-sync` in your npm scripts. Options override what the name gives: `--positions`, `--notes`, `--no-notes`, `--page` (once per page, in order) and `-o` (`-o -` writes to stdout). `segno build-sync --help` lists them.

The command is stricter than the player. If the files don't fit together, it stops and says which file and which export setting is the likely cause, instead of building a map without markers. That includes the note positions: pass `--no-notes` to build a map without the note cursor.

### When the files don't line up

The files only belong together when they come from the same score and the same settings. These are the things to watch for:
- **Turn "Play repeats" on** in MuseScore's preferences before exporting (it is on by default). The audio follows that setting, but the position files always unroll the repeats. If the audio ends before the second-to-last bar's start time, the two don't match, and `<segno-player>` plays without markers and warns. Audio that only ends before the last bar starts, as with a silent last bar, is fine: the last bar is marked when the audio ends.
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
| `tempo-min`, `tempo-max`, `tempo-step`   | The tempo buttons' range and step, in percent (default 50, 150 and 10)                          |
| `tempo-base`                             | Quarter notes a minute at 100%: the tempo controls also show "♩ = N"                            |

The playback API follows `HTMLMediaElement`: `play()`, `pause()`, `currentTime` (seconds), `duration`, `playbackRate` (pitch preserved; 0.25–2 with the built-in audio), `paused`, `error`, and the events `play`, `pause`, `playing`, `waiting`, `seeking`, `seeked`, `timeupdate`, `ratechange`, `durationchange`, `loadedmetadata`, `emptied`, `ended`, `error` and `canplay` (once the audio can play and the markers are ready). On top of that: `currentBar`, `playBar(index)` and the `barchange` event (`detail: { bar, event }`). `sync` holds the sync map in use, or `null` while there are no markers. `media` lets a host play the score through its own engine instead of the `audio` file: see [Playing through a host's media](#playing-through-a-hosts-media).

The `mode` property reflects the `mode` attribute; `resolvedMode` reports the view on screen, and `modechange` reports both as `detail: { mode, resolvedMode }`. Full score is always the default. Two-system mode crops the original engraving around pairs of systems; reflow recombines whole engraved bar regions into two prepared rows without moving individual symbols. `auto` chooses full score at a player width of 768px or more and two-system below it. The built-in layout selector and external code share the same property, so the latest selection wins. Canvas assets load on demand and fall back to full pages if they cannot be rendered.

The built-in tempo buttons adjust playback from 50–150% in steps of 10%, or within `tempo-min` and `tempo-max` in steps of `tempo-step`. The range only bounds the buttons: a rate set through `playbackRate` is shown as it is, and the next button press brings it into range. With the built-in audio, the range stays within 25–200%, which every browser can play. Back to beginning pauses and resets the score. On narrow players, a settings button reveals the score-layout selector, tempo and the "Follow score" checkbox below the playback controls. The boolean `follow` property reflects the `follow` attribute; `followchange` fires when it is switched, including by the checkbox. Following scrolls the score; turning it off leaves the markers running.

Clicking a bar plays from it. On the focused score, Space or K plays and pauses, ← and → move between bars, and Home goes to the start.

Theme it with `--segno-*` custom properties, `::part()` and container queries: see [docs/theming.md](docs/theming.md).

### Playing through a host's media

<!-- @decision(DL-037) -->

By default the player plays the `audio` file with a built-in `<audio>` element. A site can give it another engine instead, for example a synthesizer that plays the score's MIDI and changes tempo without stretching the sound. Segno itself never contains a synthesizer: the site provides an object that behaves like the part of a media element the player uses, a `SegnoMedia`:

```ts
interface SegnoMedia extends EventTarget {
  currentTime: number; // seconds in the score's timeline; setting it seeks
  readonly duration: number; // seconds; NaN until known
  readonly paused: boolean;
  readonly ended: boolean;
  playbackRate: number; // 1 is the score's own tempo
  defaultPlaybackRate: number;
  readonly error: MediaError | null;
  play(): Promise<void>;
  pause(): void;
  // Fires play, pause, playing, waiting, seeking, seeked, timeupdate, ratechange, durationchange,
  // loadedmetadata, emptied, ended, error and canplay, as a media element does.
}
```

An `<audio>` element is a `SegnoMedia`. Set it on the `media` property, and set `null` to go back to the built-in audio:

```js
import '@segnomusic/player';

const player = document.querySelector('segno-player');
const midi = new MidiMedia(); // the site's own class, implementing SegnoMedia
midi.addEventListener('canplay', () => {
  player.media = midi; // keeps the place, the tempo, and whether it was playing
});
midi.addEventListener('error', () => {
  player.media = null; // back to the audio file
});
midi.load(engineReady, scoreSeconds); // the site's own loading
```

A minimal adapter keeps its own clock and moves it as its engine plays. Its `duration` must be known by the time it fires `canplay`, or the built-in controls stay disabled:

```js
class MidiMedia extends EventTarget {
  #start = 0; // where the clock was when it last started, in seconds
  #startedAt = 0; // performance.now() then
  #rate = 1;
  paused = true;
  ended = false;
  duration = Number.NaN;
  defaultPlaybackRate = 1;
  error = null;

  get currentTime() {
    return this.paused ? this.#start : this.#start + ((performance.now() - this.#startedAt) / 1000) * this.#rate;
  }
  set currentTime(seconds) {
    this.#start = seconds;
    this.#startedAt = performance.now();
    // …move the engine to `seconds`…
    this.#fire('seeked');
  }
  get playbackRate() {
    return this.#rate;
  }
  set playbackRate(rate) {
    this.#start = this.currentTime;
    this.#startedAt = performance.now();
    this.#rate = rate;
    // …change the engine's tempo…
    this.#fire('ratechange');
  }
  play() {
    // Called within the listener's click or key press: resume an AudioContext here, before any await
    if (this.paused) {
      this.#startedAt = performance.now();
      this.paused = false;
      // …start the engine at this.#start…
      this.#fire('play');
      this.#fire('playing');
    }
    return Promise.resolve();
  }
  pause() {
    if (this.paused) return;
    this.#start = this.currentTime;
    this.paused = true;
    // …stop the engine…
    this.#fire('pause');
  }
  async load(engineReady, seconds) {
    try {
      await engineReady; // …the site's synthesizer and sound bank…
    } catch {
      this.error = { code: 4, message: 'The synthesizer failed to load' };
      this.#fire('error');
      return;
    }
    this.duration = seconds;
    this.#fire('durationchange');
    this.#fire('loadedmetadata');
    this.#fire('canplay');
  }
  #fire(type) {
    this.dispatchEvent(new Event(type));
  }
}
```

A real adapter also stops its clock at `duration`, sets `ended` and fires `ended`. `MediaError` has no constructor, so in TypeScript an adapter's `error` is a plain object cast to it (`{ code, message } as MediaError`).

A few things to know:
- **Times are the score's.** The media's `currentTime` must follow the sync map's timeline, the same as the audio file. MuseScore's MIDI of the same score does.
- **The markers read `currentTime` every frame** while playing, so a media can fire `timeupdate` only a few times a second.
- **Swapping keeps the place.** Setting `media` while playing pauses the old media, moves the new one to the same time and rate, and plays it. Events from the old one are no longer re-dispatched. The player fires `canplay` again once the new media can play, as it does for a new `audio` file.
- **`play()` is called within the user's gesture** from the built-in controls, the keyboard shortcuts and clicks on bars, so an `AudioContext` can resume inside it (iOS needs that).
- **The `audio` attribute is ignored while a media is set.** The built-in audio keeps the file it had, paused, so going back with `media = null` is instant once that file has loaded. A change to `audio` in the meantime applies when the media is cleared.
- **Removing the player** pauses its media and stops listening to it. Putting the player back listens again, so one media can outlive the player it was given to.
- **Errors** are re-dispatched as `error` events, and `player.error` is the media's. Falling back is up to the site.
- **The tempo range** from `tempo-min` and `tempo-max` applies in full: only the built-in audio is held to 25–200%.

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

If you want to build your own player, or build sync maps in your own build scripts rather than with [`segno build-sync`](#5-prebuild-the-sync-map-optional), the core does the heavy lifting without any DOM:

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
