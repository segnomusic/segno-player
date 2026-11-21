# System Snapshot

> Auto-generated from the decision log on 2026-11-21. Do not edit manually.
> Use `/dld-snapshot` to regenerate. Source of truth: individual decision records.
>
> **Active decisions:** 39 (DL-001 through DL-039, excluding superseded/deprecated)

---

## scope

### DL-001: Segno plays exports on their own engraved pages; it doesn't render or convert scores

Segno is a player that plays a score's own audio on its own engraved pages and follows along: a marker on the bar being played and a cursor that flows from note to note. In scope: a dependency-free core library that parses MuseScore's position files, builds a compact sync map and looks up what plays at a given time (DL-003, DL-004); `<segno-player>`, a framework-free web component; a small CLI to build sync maps at build time; documentation for the MuseScore export; and a demo site. Out of scope: editing, transposing, rendering MusicXML, and converting files. A hosted converter may become a separate project later; Segno must not depend on one, but its sync map format should be easy for such a service to produce.

**Rationale:** The engraver's layout is the best rendering of the score there is, and the score's own audio export is already aligned with it. A player that only displays and follows can stay small and exact.

**Code:** `src/core/index.ts`

*Amended by: DL-022*

---

## inputs

### DL-002: MuseScore's position files are the input, and its unrolled playback order is the truth

Segno's inputs are, all from one MuseScore export: the `.mpos` file (required: bar boxes and the playback order with times), the `.spos` file (optional: note positions), the SVG pages (only each page's `viewBox`, read by `readViewBox`), and the audio. Segno never interprets the score; MuseScore's unrolled event list is the truth for playback order and timing, with no repeat, jump or tempo logic of its own. Positions convert at a fixed 12 position units per SVG unit (`MPOS_UNITS_PER_SVG_UNIT`, overridable via `buildSync`'s `unitsPerSvgUnit`). `buildSync` rejects files that don't belong together: no elements or non-numeric coordinates, elements on pages that weren't given, boxes outside their page by more than 1%, events naming missing elements, or backwards event times. Parsing uses a small attribute parser, not an XML library.

**Rationale:** Reusing MuseScore's unrolled playback order avoids reimplementing repeats, voltas and jumps and getting edge cases wrong; its own audio is already aligned to its own events. The writer backs MuseScore's `--score-media` export and is actively maintained.

**Code:** `src/core/positions.ts` → `parsePositions`, `src/core/sync-map.ts` → `MPOS_UNITS_PER_SVG_UNIT`, `src/core/sync-map.ts` → `toPageFractions`, `src/core/svg.ts` → `readViewBox`

---

## format

### DL-003: A versioned sync map format with positions as fractions of the page

`buildSync()` produces a **sync map**, plain JSON, format version 1: `v`, `bars` (one `[page, x, y, w, h]` per bar in score order), `events` (`[barIndex, ms]` in playback order), and — only when an `.spos` was given — `notes` (`[page, x, y, h]`) and `noteEvents`. All positions are fractions of the page (0–1) rounded to 5 decimals; entries are positional tuples. The version changes whenever an old reader would misread new data; readers reject unknown versions. The format is documented for other producers in `docs/sync-map.md`.

**Rationale:** Page fractions let a player show pages at any size and place markers in percentages with no page sizes needed at play time; tuples keep a typical song's map around 2 KB, small enough to embed in every page showing a score.

**Code:** `src/core/sync-map.ts` → `SyncMap`, `src/core/sync-map.ts` → `buildSync`, `docs/sync-map.md`

*Amended by: DL-036*

---

## core

### DL-004: A dependency-free core that runs in Node and the browser

The core (`src/core`, published as `segno/core`) has **no runtime dependencies** and **uses no DOM or Node APIs** — strings and plain data only, running unchanged in Node 22+ and evergreen browsers. The build compiles it against the ES2023 library alone (no `dom` lib in `tsconfig.build.json`), so a DOM API used by mistake fails the build.

**Rationale:** One implementation for build time and the browser with no shims; no dependencies means no supply-chain exposure and a small download (~3 KB gzipped, unminified).

**Code:** `src/core/index.ts`, `tsconfig.build.json`

*Amended by: DL-025*

---

### DL-009: Timeline lookups: the note cursor's motion, the notehead estimate and seeking within repeats

`createTimeline(sync)` provides: `at(ms, endMs)` — binary search for the last event at or before `ms`, returning `{ event, bar, page, box, progress, note }` (before the first event it reports the first bar with progress 0; `endMs` bounds the last bar's progress); `noteAt(ms, endMs)` — the note cursor position, moving linearly in time between notes on the same system, running to the barline's right edge at a line's end, and jumping otherwise; `barAtPoint(page, fx, fy)`; `seekTimeForBar(bar, nowMs)` — the pass through a repeat closest to the current position, so clicking within a repeat stays in the same pass; and `eventIndexAt(ms)`. Because an `.spos` segment's width is its widest element, `buildSync` places each note at x plus half a typical notehead — the 10th percentile of all segment widths in the score.

**Rationale:** Even cursor motion gives the eye a continuous line that arrives as each note sounds; running on to the barline reads as "this line is done"; nearest-pass seeking matches what a reader means inside a repeat; the 10th percentile is robust to accidental-heavy scores.

**Code:** `src/core/timeline.ts` → `createTimeline`, `noteAt`, `seekTimeForBar`; `src/core/sync-map.ts` → `buildSync`

---

## player

### DL-005: `<segno-player>`, a framework-free web component, as the main integration

The main integration is `<segno-player>`, a framework-free custom element: a script tag and the element, and the pages play. Inputs are file URLs (fetched and built into a sync map in the browser) or a prebuilt map via `sync`. Options: `bar-lead`, `note-lead`, `note-cursor`, `bar-change`, `follow`. Built-in controls show only with the boolean `controls` attribute, as with `<audio>`; sites can slot their own controls. The playback API follows `HTMLMediaElement` (`currentTime`, `duration`, `playbackRate` with pitch preserved, `paused`, `play()`/`pause()`, `error`, the media events, plus `canplay`), and adds `barchange` (with bar and event index in `detail`), `currentBar`, `playBar(index)`, the `sync` property and `follow`/`followchange`. Pages render as `<img>` with markers in percent-positioned overlays, updated on `requestAnimationFrame`. Accessibility: keyboard play/pause/seek, polite current-bar announcements, reduced motion respected, settable alt text. Safety checks: audio shorter than the last event's time plays without markers and warns ("Play repeats" was off); a failed sync map shows pages and audio without markers.

**Rationale:** Custom elements work in every modern browser and framework with no build step on the site; following `HTMLMediaElement` means the API is already familiar and code written for `<audio>` mostly carries over.

**Code:** `src/player/element.ts` → `SegnoPlayer`, `src/player/index.ts`

*Amended by: DL-018, DL-024, DL-025, DL-028, DL-037, DL-039*

---

### DL-006: Marker design and default leads

The player draws two markers, tuned by ear on real scores: a **bar marker** — a static light tint over the whole system height (7% of the accent colour), reaching 1.2% of the page width into each neighbouring bar and fading out at the sides via a CSS mask, multiplied over the page so notes stay black; it crossfades between bars (90 ms in, 260 ms out) or switches at once with `bar-change="jump"`; and a **note cursor** — a thin line through the system (2 px, accent at 55%) that moves every frame, evenly from note to note, arriving as each sounds and running on to the barline at a line's end. Leads: bar +15 ms, note −20 ms, both scaled by the playback rate and configurable via `bar-lead`/`note-lead`. Clicking a bar plays from the nearest pass inside repeats; follow-scroll brings an off-screen system to about a quarter from the top.

**Rationale:** The static tint keeps the bar readable and marks where the music is without moving; the cursor gives the eye something to follow between bar changes. Values are defaults, not constants — sites tune them through attributes and custom properties, and marker changes should be tried on real scores.

**Code:** `src/player/element.ts` → `#placeBar`, `src/player/styles.ts` → `css`

---

### DL-033: Type the element's attributes with one exported type and document framework registration

`SegnoPlayerAttributes` — the type of the element's attributes — is exported from the package root. The README documents a short type registration for React, Vue and Svelte, and the schema for Angular. No framework-specific type files, subpath exports or wrapper components, and no dependency on any framework's types.

**Rationale:** One exported type is the only piece every framework needs; the registration is a few lines that belong in the user's project. Shipping augmentations of `react`, `vue` or `svelte` would tie releases to those frameworks' type changes.

**Code:** `src/player/attributes.ts` → `SegnoPlayerAttributes`, `src/player/index.ts`

---

## segno-player

### DL-014: The player renders into a shadow root: page images with percent-positioned marker overlays

The element renders into an **open shadow root**: a focusable `pages` area (with the keyboard shortcuts) holding one `page` per SVG page — an `<img part="page-image">` plus an overlay of percent-positioned markers (a crossfading pair of bar markers, the `note-cursor`) — then a `controls-area` with `<slot name="controls">` (built-in bar as fallback, DL-016) and a polite `aria-live` region. Page size comes from the SVG `viewBox`; the image scales to the player's width. A marker's box is the sync map's page fractions as `left`/`top`/`width`/`height` percentages, so markers stay on their bars at any size without measuring the DOM. The bar marker pair moves between page overlays as playback crosses pages; page images get alt text from the `alt` attribute; each page has its aspect ratio before its image arrives so the layout doesn't jump.

**Rationale:** Shadow DOM isolates the player's markup and styles both ways while still letting sites theme through custom properties and `::part()`. Images are the cheapest way to show an SVG page; percent-positioned overlays need no resize handling.

**Code:** `src/player/element.ts` → `SegnoPlayer`, `src/player/styles.ts` → `css`

*Amended by: DL-022, DL-029*

---

### DL-015: Theming through --segno-* custom properties, parts, a size container and style-query presets

CSS custom properties are the public theming API, documented with defaults in `docs/theming.md`: `--segno-accent`, `--segno-bar-strength`, `--segno-bar-fade-in/out`, `--segno-cursor-width/strength`, `--segno-page-gap/background/shadow`, `--segno-controls-background/color/radius/gap`, and `--segno-font`. Defaults live in `var(--segno-…, default)` fallbacks inside the shadow styles, never on `:host`, so values set anywhere on the page inherit and win. `::part()` names are stable API for structural styling. The player is a size container (`segno-player / inline-size`), so the built-in controls lay out by the player's width; sites can target it in their own container queries. As enhancements, style-query presets switch coordinated values: `--segno-controls: compact` and `--segno-markers: strong`; browsers without style queries keep the defaults. Controls default to a dark bar with light text on both light and dark sites.

**Rationale:** Variables cross the shadow boundary, cascade like any CSS, and can be scoped by any selector or query, making them the most flexible and least surprising theming surface; keeping defaults in fallbacks avoids `:host` declarations overriding inherited values.

**Code:** `src/player/styles.ts` → `css`, `docs/theming.md`

*Amended by: DL-024*

---

### DL-016: Built-in controls from native elements, keyboard shortcuts and polite announcements

The built-in controls are a sticky bar of native form elements: a play/pause `<button>` (part `play-button`), a back-to-beginning button, elapsed time and duration around the seek slider (parts `time`, `current-time`, `duration`), a range seek input over the whole audio with accessible value text, a tempo stepper of native slower/faster buttons (50–150%, steps of 10, `playbackRate` with pitch preserved, politely announced), and a "Follow score" checkbox synced with the `follow` attribute. They are the fallback content of the controls slot, shown only with `controls`. Below 44rem (size container query) a settings button reveals tempo and follow in a second row (Escape closes it and restores focus); `--segno-controls: compact` shows only play and seek. The controls area is sticky at the bottom of the viewport; play, restart and seek are disabled until the audio has a usable duration. Keyboard on the pages area: Space or K plays/pauses, ← and → move a bar (five seconds without markers), Home goes to the start; modified keys are left to the browser and a held key doesn't repeat. The current bar is announced politely on pause or after a seek, not during continuous playback.

**Rationale:** Native elements bring keyboard, focus and assistive-technology support for free and are easy to theme; moving settings behind a button on narrow players keeps the seek slider un-crowded.

**Code:** `src/player/controls.ts` → `createControls`, `src/player/element.ts` → `#onKey`

*Amended by: DL-024, DL-029, DL-038*

---

### DL-017: Loading, the animation loop and falling back to plain playback

**Loading:** every input-attribute change starts a new load and cancels the previous one (`AbortController`). With `sync` (URL attribute or `sync` property) the map is used as-is; otherwise the positions file, the optional notes file and each SVG page's text are fetched in parallel, each page's size read (`readViewBox`) and the map built (`buildSync`). A notes file that fails or doesn't fit only drops the note cursor. The element remembers which inputs it applied — upgrades, moves (even `moveBefore()` while playing) and reconnects don't load twice.

**Fallbacks:** the player never blocks playback on the markers — a map that fails to load or build, an unknown version, wrong-shaped entries, or audio shorter than the last event's time all fall back to pages and audio without markers, with a console warning explaining why. `sync` is `null` and `playBar()` rejects while there are no markers; `canplay` fires once the audio can play and the load has settled either way.

**The loop:** while playing, a `requestAnimationFrame` loop reads `audio.currentTime` and updates the markers at `t + lead × playbackRate`; while paused they update on `seeked` and `timeupdate`; before playing they show where playback will start. `barchange` fires when playback moves to another bar or to the same bar's next pass through a repeat (`detail.event` distinguishes them).

**Follow:** with the `follow` attribute, when the playing system leaves the viewport the player scrolls it to about a quarter from the top, smoothly unless reduced motion is preferred.

**Rationale:** Markers that are wrong are worse than no markers, so every mismatch falls back to plain playback with an explanation; reading `currentTime` each frame keeps markers in step through seeks, tempo changes and stalls.

**Code:** `src/player/load.ts` → `loadSync`, `src/player/element.ts` → `#loadSync`, `src/player/element.ts` → `#update`

*Amended by: DL-023, DL-036, DL-037, DL-039*

---

### DL-018: The player ships as ES modules, without a bundler

*Amends: DL-005, DL-010, DL-011*

**ES modules only, no bundler, for now.** `tsc` builds the player like the core, and the package exports it as `segno/player`; importing it defines `<segno-player>` once, if not already defined. The package's `sideEffects` lists the player's entry module. Without a build step on the site, it loads straight from a CDN (`dist/player/index.js`); the core is compiled against the ES library alone, the player in a second pass with the DOM library. A single-file bundle may be added later as an alternative, not a replacement.

**Rationale:** The modules are a handful of small files that HTTP/2 serves about as fast as one; skipping a bundler keeps the toolchain to `tsc` and the published code identical to the source.

**Code:** `src/player/index.ts`, `tsconfig.build.player.json`, `package.json` → `exports`

*Amended by: DL-025, DL-032*

---

### DL-019: Browser tests with Vitest's browser mode in Chromium

*Amends: DL-011*

The element is tested with **Vitest's browser mode**, running Chromium through Playwright (`@vitest/browser-playwright`). One `vitest` command runs two projects — `core` in Node and `player` in Chromium — with coverage merged against the same 90% floor. Tests need no real score: a blank SVG page with the fixture's page size and a generated silent WAV of the right length (both blob URLs) drive loading, seeking, events and marker positions. Chromium runs with autoplay allowed; CI installs it for Playwright, and locally `CHROMIUM_PATH` can point at an existing Chromium.

**Rationale:** One runner, one config and one coverage number, with the element tested where it runs; synthetic pages and audio keep tests fast and licence-independent.

**Code:** `vitest.config.ts`, `src/player/test-assets.ts`, `.github/workflows/ci.yml`

---

### DL-020: The demo plays a bundled example or the visitor's own export

*Amends: DL-013*

The demo initially loads **När juldagsmorgon glimmar** (Fria Noter, CC BY 4.0), a bundled example in a `<segno-player>` with controls and follow on; playback starts only when the visitor presses play. The `.mscz` source and its matching SVG, MP3, `.mpos` and `.spos` exports live in `fixtures/nar-juldagsmorgon-glimmar/` (listed in `fixtures/SOURCES.md`) and are copied into `site/scores/` at build time, with credit links and the tempo adjustment (to 103.5 BPM, made in the score itself) identified. **"Try it with your own export"** stays available in an expandable section: the visitor picks one export's files and the same player switches to them — everything stays in the browser (object URLs), pages ordered by the number in their names, with a button back to the bundled example. The demo loads the player from the built package files copied into `site/segno/`.

**Rationale:** A bundled example lets anyone try playback immediately, including on phones; keeping the own-files workflow alongside lets someone check their own score before publishing it.

**Code:** `demo/index.html`, `scripts/build-demo.mjs`

---

### DL-037: Hosts can give the player its media through a media property

*Amends: DL-005, DL-017*

The player accepts an external media object and never contains a synthesizer itself. **`SegnoMedia`** (exported type) is what the player needs from its audio: a subset of `HTMLMediaElement` — an `EventTarget` with `currentTime` (settable, seeks), `duration` (`NaN` until known), `paused`, `ended`, `playbackRate`, `defaultPlaybackRate`, `error`, `play()` (a promise) and `pause()` — firing the media events the player re-dispatches plus `canplay`; an `HTMLAudioElement` is a `SegnoMedia`. **`player.media`**: setting it routes everything through that object; setting `null` returns to the internal `<audio>`, which stays the default and keeps its source paused so the host can fall back at once. While set, the `audio` attribute is ignored. **Swapping while playing keeps the place**: the player detaches listeners, reads `currentTime` and playing state, pauses the old media, then gives the new one that time and rate and plays it if the old one was playing. Readiness is `canplay` or a known `duration`; the audio-length check runs against the current media and again on each swap. Errors reading the old media are ignored (it is often swapped out because it failed); an error from the new media is thrown after the UI shows the new state. Removing the player pauses its media and stops listening; reconnecting listens again. The loop reads the current media's `currentTime` every frame; user gestures call the media's `play()` synchronously so a host's `AudioContext` can resume inside the gesture.

**Rationale:** A media-shaped object is the smallest contract that lets a host bring any engine — a synthesizer for clean slow playback, as Segno OMR needs — without Segno carrying one, staying within DL-001's scope and the size budget; the internal `<audio>` staying loaded makes fallback instant.

**Code:** `src/player/media.ts` → `SegnoMedia`, `src/player/element.ts` → `media`, `src/player/element.ts` → `#listen`, `src/player/index.ts`, `src/player/test-assets.ts` → `FakeMedia`, `README.md`

---

### DL-038: Tempo range attributes, a tempo in quarter notes, and pitch kept on older iOS

*Amends: DL-016*

- **`tempo-min`, `tempo-max`, `tempo-step`** (percent; defaults 50, 150, 10; a non-positive value falls back to its default, and `tempo-min` above `tempo-max` resets both) bound **the built-in stepper only**: its buttons move by `tempo-step` within the range and disable at its limits. A rate set through the API is not limited and is displayed as is.
- **The internal `<audio>`** is limited to 0.25–2 for the API and the stepper alike (a rate outside that would mute or fail rather than be slow); an external media is not limited by the player and gets the attributes' full range.
- **`tempo-base`** (quarter notes per minute at 100%): when positive, the tempo control shows "♩ = N" beside the percentage (part `tempo-bpm`), `tempo-base` × rate, rounded, with accessible text in the player's language.
- The internal `<audio>` sets `webkitPreservesPitch` beside `preservesPitch`, keeping pitch on iOS before 17.2.

**Rationale:** Percent attributes match what the stepper shows and keep 0.3.0's behaviour; bounding only the stepper keeps the API backwards compatible; the BPM display helps musicians who think in metronome marks.

**Code:** `src/player/media.ts` → `tempoRange`, `AUDIO_RATES`; `src/player/controls.ts` → `createControls`; `src/player/element.ts` → `#setRate`; `src/player/attributes.ts` → `SegnoPlayerAttributes`

---

### DL-039: Tolerating a silent last bar after the audio's end

*Amends: DL-017, DL-005*

**The audio is too short only when it ends before the second-to-last event starts.** A shortfall that only puts the last event's start after the audio's end is tolerated — markers stay on, nothing is logged. A one-event map keeps the old rule. The check reads the current media's duration and re-runs on `durationchange` and each `media` swap. **At the end of the media, the markers show the last event**: while `ended` or at `duration`, markers are placed as if playback were at the last event's time, and `currentBar`/`barchange` report it. **`playBar()` on a bar past the end** seeks to the end (which marks the bar) and resolves without calling `play()`. A real mismatch keeps its console warning and "Play repeats" hint; the player never inspects audio content to guess silent bars.

**Rationale:** A threshold at the second-to-last event scales with tempo and bar lengths where a fixed number of seconds would not; ending before a silent last bar is common (final rests, fermatas, synthesizer or trimmed audio), and dropping every marker for it is worse than marking the last bar at the very end.

**Code:** `src/player/element.ts` → `#checkAudioLength`, `#update`, `playBar`; `src/player/element.test.ts`

---

## canvas-viewport

### DL-022: Canvas score views preserve the original engraving

*Amends: DL-001, DL-014*

`<segno-player>` supports full-score, two-system, and reflow score views. Two-system crops the original pages around engraved system pairs; reflow crops and recombines whole bar regions into new rows at a locked scale. Neither view moves individual symbols, interprets notation, re-engraves music, or alters the source SVG. Full score remains the existing page-image renderer and the initial default; the alternative views are rendering options of the same player, not a separate notation engine. Bar and system crops must retain enough context and padding to avoid clipping notation, and multi-page scores, repeat-aware playback, seeking and click-to-play must work in every view.

**Rationale:** This extends the original purpose of playing unaltered, manually laid-out engravings rather than replacing it; keeping full score as the default preserves the established contract and makes mobile adaptation an explicit choice.

**Code:** `src/player/canvas-layout.ts` → `CanvasLayout`, `src/player/element.ts` → `#refreshMode`, `src/player/canvas-layout.test.ts`

*Amended by: DL-031*

---

### DL-023: Canvas rendering separates pure layout, lazy rasters, and playback overlays

*Amends: DL-017, DL-011*

Canvas rendering divides into **pure layout calculations** (systems, bar groups, stable crops, reflow rows, coordinate projections, hit-testing — no DOM or audio access) and a **page-aware canvas view** (`CanvasView`: resizing, SVG decoding, a lazy per-page raster cache with resolution and memory limits). `SegnoPlayer` remains the sole media and timeline orchestrator; static score pixels redraw only when the source, mode, window, grouping, page, container size or pixel density changes; the existing DOM bar and note overlays move above the canvas through layout projections, so only lightweight overlays update during playback. Full score remains the fallback when sync or canvas assets are unavailable; canvas SVG assets load on demand (including with prebuilt maps); mode changes preserve media time, playback state, tempo and timeline state; canvas loading doesn't block audio or change the `canplay` contract. Raster failure degrades to full pages and audio. The player size budget rises from 12,000 to 24,000 bytes gzipped.

**Rationale:** Separating geometry from rendering makes the spike mathematics testable and prevents DOM/media coupling; static rendering plus DOM overlays avoids repeated resampling while preserving theming; lazy bounded rasters make memory use predictable for multi-page scores.

**Code:** `src/player/canvas-view.ts` → `CanvasView`, `src/player/element.ts` → `#placeBar`, `scripts/check-size.mjs`, `src/player/canvas-view.test.ts`, `src/player/element.test.ts`

*Amended by: DL-029, DL-031*

---

### DL-024: Public score mode API with container-based auto selection

*Amends: DL-005, DL-015, DL-016*

`<segno-player>` exposes `mode="full|two-system|reflow|auto"`, a reflected `mode` property, a read-only `resolvedMode` (auto excluded), and a `modechange` event reporting requested and resolved modes. Default `full`; invalid values use the default. In `auto`, a `ResizeObserver` resolves `full` at a host inline size of 768 CSS pixels or larger and `two-system` below; manual modes don't respond to width changes, and reflow is opt-in. The built-in settings gain a native selector (Auto, Full score, Zoom, Reflow) writing the public `mode` property; the latest user or developer selection wins, and preferences are not persisted.

**Rationale:** One requested-mode field gives external and built-in controls predictable two-way synchronization; a separate resolved mode makes automatic behaviour observable; host-width measurement works in embedded layouts and keeps `full` the default for existing consumers.

**Code:** `src/player/mode.ts` → `scoreMode`, `src/player/element.ts` → `mode`, `src/player/controls.ts` → `createControls`, `src/player/styles.ts` → `css`, `src/player/mode.test.ts`, `src/player/element.test.ts`

*Amended by: DL-029*

---

## engraving-relative-zoom

### DL-031: Calibrate canvas zoom from engraved staff size

*Amends: DL-022, DL-023*

Zoom and reflow calibrate from the engraved staff size instead of bar widths: measure staff-line spacing within each `.mpos` system's vertical bounds, require a matching SVG `BarLine` extent, reject measurements inconsistent with those bounds, and use the **median staff height** to choose one score-wide content width of **15 staff heights** (calibrated against the readable Härlig är jorden rendering). That width drives both two-system crops and reflow rows, so equal engraved staff sizes have equal CSS size at the same player width. Groups hold up to two consecutive bars within a system, starting a new group when adding a bar would exceed the content width (expanded only when a single padded bar cannot fit). The bottom of SVG `Lyrics` geometry is measured and associated with the preceding system on the same page, extending content bottoms — replacing reliance on `.mpos` heights, which cover a whole system in some exports and only a staff in others. Without usable staff lines or lyrics, the previous widest-group / vertical-bounds calculations remain as fallbacks.

**Rationale:** Staff-line spacing directly represents the engraved scale, unlike bar widths or variably reported system bounds; width-aware grouping prevents one unusually wide pair from shrinking every other group; lyric geometry supplies the content extent short `.mpos` bounds omit.

**Code:** `src/player/canvas-layout.ts` → `readEngravingGeometry`, `CanvasLayout`; `src/player/canvas-view.ts` → `setScore`; `src/player/canvas-layout.test.ts`

---

## player-localization

### DL-027: Typed built-in English and Swedish player dictionaries

Player-owned user-facing messages live in one typed dictionary map with complete `en` and `sv` entries satisfying a shared schema (score-mode names included). Messages containing page numbers, bar numbers, times or an optional title are whole-phrase formatter functions, not concatenated fragments. The catalog stays internal to the player package with no runtime dependencies. Visible controls and accessibility text are translated; developer-facing exceptions and console diagnostics stay English; supplied score titles are unchanged; the core and sync-map format are untouched. No runtime dictionary registration, lazy language packs or language picker.

**Rationale:** A typed catalog makes missing translations a compile-time error and allows natural word order without an i18n framework; two small dictionaries keep CDN and SSR use as simple as before.

**Code:** `src/player/localization.ts` → `Messages`, `src/player/localization.test.ts`

---

### DL-028: Resolve player language from standard HTML lang inheritance

*Amends: DL-005*

The standard HTML `lang` attribute is the public language API: an explicit player language wins; otherwise the inherited language from ancestors — including shadow hosts and the document element — applies, matched case-insensitively with regional tags (`sv-SE` → `sv`) via the native `:lang(sv)` selector. Unsupported, explicitly empty or unspecified languages use the complete English catalog; language is never inferred from browser preferences, and there is no separate locale property or language-change event. The player reacts to its own and ancestors' `lang` changes while connected, resolves again after reconnection or state-preserving moves, observes only relevant ancestor attributes, and marks translated regions with the resolved catalog language so fallback text is announced as English without overwriting the author's `lang`.

**Rationale:** Standard HTML inheritance keeps the player aligned with its host site and gives authors the usual per-element override; deterministic English fallback avoids mixing dictionaries.

**Code:** `src/player/localization.ts` → `languageOf`, `src/player/element.ts` → `#observeLanguage`, `src/player/element.test.ts`

---

### DL-029: Localize controls and accessible descriptions in place during playback

*Amends: DL-014, DL-016, DL-023, DL-024*

All built-in control text, score-mode options, control and score ARIA labels, seek value descriptions, page and canvas descriptions, and current-bar announcements use the catalog selected by DL-028, updated **in place** — text and attributes change on the existing nodes; buttons, inputs, options, page images and the canvas are never recreated. Playback state, current time, rate, follow state, mode selection, settings-panel expansion, focus and slotted custom controls are preserved; language changes must not reload score or audio assets or redraw the canvas. An in-flight polite bar announcement is translated in place, but continuous announcements are not started; subsequent pause and seek announcements use the new language. Custom slotted controls and externally supplied titles remain the site's.

**Rationale:** Keeping the existing DOM nodes and media lifecycle avoids lost focus, closed panels, duplicate listeners and interrupted audio; accessibility strings are as much part of localization as visible labels.

**Code:** `src/player/controls.ts` → `createControls`, `src/player/element.ts` → `#updateLanguage`, `src/player/canvas-view.ts`, `src/player/element.test.ts`, `README.md`

---

## cli

### DL-034: The segno CLI ships as a bin in @segnomusic/player

*Amends: DL-010, DL-026*

The CLI lives in this repository and ships in `@segnomusic/player` as the bin `segno` (`"bin": { "segno": "./dist/cli/index.js" }`), holding commands that prepare the player's inputs — each command beyond `build-sync` gets its own decision. Sources in `src/cli` compile with `tsc` through their own build config with Node's types; the CLI is the only part of the package using Node APIs, and it uses the core only through `src/core/index.ts`, never the player. `dist/cli` is not a subpath export and not a library. One bin means `npx @segnomusic/player <command>` works without an install and `segno <command>` in npm scripts. No runtime dependencies: `node:util` `parseArgs` and `node:fs/promises`; Node 22+. `--help`/`--version` print to stdout and exit 0; no or unknown command prints usage to stderr and exits 2; wrong arguments name the problem and point to the command's `--help`, exit 2. Tested with Vitest in Node in its own `cli` project; the packed-tarball check (DL-026) also runs the installed bin. This replaces DL-026's line deferring the CLI to a separate repository; an unscoped `segno` wrapper package remains possible later.

**Rationale:** One package keeps one install and one version, with the CLI tested against the same core and format version it ships with; building on the public core entry keeps the core DOM-free and Node-free; a single bin is what lets `npx` run a scoped package's command without `-p`.

**Code:** `package.json` → `bin`, `tsconfig.build.cli.json`, `src/cli/index.ts`, `src/cli/main.ts` → `run`, `src/cli/command.ts`, `vitest.config.ts`, `scripts/check-package.mjs`, `scripts/check-spdx.mjs`

---

### DL-035: segno build-sync finds a MuseScore export by name and writes its sync map

`segno build-sync [<name>] [options]`: `<name>` is the export's path without an extension — from it the command takes `<name>.mpos` (required), `<name>.spos` (when it exists) and the pages `<name>-1.svg`, `<name>-2.svg`, … counting up to the first missing number (globs would mis-sort `song-10.svg` before `song-2.svg`). Options override the name: `--positions`, `--notes`, `--no-notes`, `--page` (repeatable, in order), `-o/--out`; without `<name>`, positions, at least one page and `--out` are required. The map is written to `<name>.sync.json` (overwriting) or stdout with `-o -` — compact JSON with a trailing newline — and a one-line summary goes to stderr. A build step is strict: a missing or non-fitting `.spos` fails with a hint to pass `--no-notes` rather than falling back to a bars-only map as the browser does. Errors name the file involved and print the core's message, with a short hint about the export settings that make positions and pages disagree; failures are reported in read order (positions, notes, pages). Exit codes: 0 success, 1 file/build failure, 2 usage error.

**Rationale:** MuseScore's own naming makes the usual case one argument while flags cover renamed files; failing on a bad `.spos` keeps a broken note cursor from shipping unnoticed — at build time the publisher is there to fix it; not matching the core's message text keeps core messages free to change.

**Code:** `src/cli/build-sync.ts` → `buildSyncCommand`, `src/cli/build-sync.test.ts`, `README.md`

---

### DL-036: Sync maps carry their pages' sizes, so prebuilt maps keep the layout stable

*Amends: DL-003, DL-017*

Sync map version 1 gains an optional field: `"pages": [[w, h], …]` — one `[w, h]` per page, in page order, as read from each SVG's `viewBox` in its own units (only the ratio is meaningful; readers must not assume a unit). `buildSync` always writes `pages`; maps without it (older maps, other producers) stay valid and `v` stays 1. `checkSyncMap` validates it when present — positive finite numbers, every bar and note within its page — and a map whose page count differs from the pages the player was given is rejected like any other mismatch: the player plays without markers and warns. The player takes each page's aspect ratio from the map for the `sync` attribute, the `sync` property and maps it builds itself alike; `loadSync` no longer returns page sizes of its own. `docs/sync-map.md` documents the field.

**Rationale:** The sizes cost a few bytes per page and remove the layout jump that every prebuilt map otherwise suffered while its images loaded; the page-count check catches a map built for another export of the same score, which would otherwise draw markers on the wrong pages.

**Code:** `src/core/sync-map.ts` → `Page`, `buildSync`; `src/player/load.ts` → `checkSyncMap`; `src/player/element.ts` → `#loadSync`, `#setPageSizes`; `docs/sync-map.md`

---

## packaging

### DL-010: One ESM package, segno, with subpath exports

One npm package, `segno`, with subpath exports: `segno/core` (the library) now; `segno/player` (defines `<segno-player>`) and a `segno` CLI bin when they exist. No root export, so every import says what it uses. ESM only, Node 22+ (`engines`) and evergreen browsers. Built with `tsc` to `dist/` with type declarations, declaration maps and source maps; the TypeScript sources are published too. `sideEffects: false` while the package holds only the core.

**Rationale:** One install and one version to track; the core, player and CLI change and are tested together; subpath exports keep the core usable on its own — the reason a separate core package would exist.

**Code:** `package.json` → `exports`, `tsconfig.build.json`

*Amended by: DL-018, DL-025, DL-032, DL-034*

---

### DL-025: Segno Music organization, scoped player package, and migrated project URLs

*Amends: DL-004, DL-005, DL-007, DL-010, DL-013, DL-018*

Use **Segno / Segno Music** as the overall brand, **`segnomusic/segno-player`** as this repository, and **`@segnomusic/player`** as the single npm package, with subpaths `@segnomusic/player/core` and `@segnomusic/player/player`; the CLI remains named `segno` when added. The demo root is `https://segnomusic.github.io/segno-player/` with pull-request previews under `pr-preview/pr-<number>/`. Repository metadata, documentation, demo links, package imports and CDN examples, contributor commands, and SPDX source links use the new locations; GitHub Pages continues to deploy from `gh-pages`.

**Rationale:** A shared organization and npm scope leave room for related tools without ambiguity; renaming before the first npm release avoids legacy aliases and migrations for consumers.

**Code:** `package.json`, `README.md`, `CONTRIBUTING.md`, `demo/index.html`, `docs/logo.svg`

*Amended by: DL-032*

---

### DL-032: Use the package root for the component and remove the player subpath in 0.3.0

*Amends: DL-010, DL-018, DL-025*

For 0.3.0, the existing component module is exposed at the package root `@segnomusic/player`, and the `./player` export is removed entirely, without a compatibility alias. `@segnomusic/player/core` and `@segnomusic/player/package.json` are unchanged. Root JavaScript and TypeScript resolution points directly to `dist/player/index.js` and `dist/player/index.d.ts` — no wrapper, no moved files. `sideEffects`, browser registration, lazy imports and SSR-safe importing are preserved; the explicit CDN file URL is unchanged. The removal is marked breaking in a minor changeset targeting 0.3.0, with migration notes for side-effect, dynamic and named/type imports in the release notes and README. Historical decisions and released changelog entries retain their original paths.

**Rationale:** The scoped package name already says player, making `@segnomusic/player/player` redundant; Fria Noter is the only known consumer and the maintainer prefers a clean pre-1.0 break over preserving the old path.

**Code:** `package.json` → `exports`, `src/player/index.ts`, `scripts/check-package.mjs`, `README.md`, `CONTRIBUTING.md`

---

## release

### DL-012: Releases with Changesets and npm trusted publishing

**Changesets** for versioning and changelogs: every pull request changing the published package adds a changeset. The release workflow runs on every push to `main` using separate `changesets/action` steps so each job gets only the permissions it needs: `select-mode` decides between versioning and publishing, `version` opens or updates a "Version Packages" pull request, and `publish` runs every check then `changeset publish`. **npm trusted publishing (OIDC)** with provenance — no npm token stored; the publish job runs in the `npm` GitHub environment the trusted publisher is tied to. The first publish uses an `NPM_TOKEN` secret, removed once the trusted publisher is configured. Before 1.0, versions are `0.x`.

**Rationale:** Trusted publishing gives each release a short-lived credential bound to this repository, workflow and environment, with provenance attached automatically; splitting the steps keeps `id-token: write` away from the job that opens pull requests.

**Code:** `.changeset/config.json`, `.github/workflows/release.yml`, `package.json` → `publishConfig`

*Amended by: DL-026*

---

### DL-026: Validate release tarballs and bootstrap npm locally before OIDC publishing

*Amends: DL-012*

The Changesets version-PR and OIDC publish model of DL-012 stays. Additions: main-only manual dispatch for retrying releases; both version candidates and published releases validated with the full checks; Chromium installed in the jobs that run browser tests; a packed tarball smoke-tested as an actual install in a clean temporary consumer; versioning updates the npm lockfile before validation; building happens during packing so a local publish cannot ship stale files. The GitHub `npm` environment permits branch `main` only; release builds restore no package-manager cache; Actions must be allowed to create version PRs while default token permissions stay read-only. `@segnomusic/player@0.1.0` is bootstrapped with a local npm login after merging its release PR, provenance disabled only for that publish (it cannot issue OIDC attestations); no npm publishing token is stored in GitHub; the trusted publisher is configured for `segnomusic/segno-player`, workflow `release.yml`, environment `npm`, and later releases use OIDC with provenance. One-time first-publish and verification steps live in the release handoff, not `CONTRIBUTING.md`.

**Rationale:** Testing the installed tarball catches missing files and export mistakes that repository self-imports miss; the local bootstrap avoids a long-lived write token, with its provenance limitation explicit; manual dispatch permits retries without dummy commits.

**Code:** `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `package.json`, `scripts/check-package.mjs`, `src/player/canvas-view.test.ts`, `CONTRIBUTING.md`

*Amended by: DL-034*

---

## tooling

### DL-011: Strict TypeScript, Biome, Vitest with a coverage floor, a size budget, all in CI

- **TypeScript, strict:** `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` and the unused-code checks; no `any` (also a Biome error); `tsc --noEmit` in CI; TypeScript 7, the native compiler.
- **Biome** for lint and format (code, JSON and Markdown) — no ESLint or Prettier; `biome ci` in CI.
- **Tests:** Vitest for the core; Playwright browser tests for the element once it exists. A **coverage floor of 90%** of lines, functions, branches and statements, enforced by Vitest's thresholds; the floor only goes up.
- **Size budget:** `scripts/check-size.mjs` checks each built entry point's gzipped size against its budget (core: 4000 B), measuring the readable `tsc` output, not a minified bundle.
- **Licence headers:** `scripts/check-spdx.mjs` (DL-007).
- **CI:** GitHub Actions on every push to `main` and every pull request, on Node 22 and 24; third-party actions pinned to commit SHAs; `npm run check` runs the same steps locally. Default branch: `main`.

**Rationale:** The strict flags catch the index and optional-property mistakes a parser over external files invites; a rising-only coverage floor and a visible size budget keep quality pressure honest without being unreachable.

**Code:** `tsconfig.json`, `biome.json`, `vitest.config.ts`, `scripts/check-size.mjs`, `.github/workflows/ci.yml`

*Amended by: DL-018, DL-019, DL-023*

---

## demo

### DL-013: The demo and pull request previews on GitHub Pages, from a gh-pages branch

The demo is hosted on **GitHub Pages, published from the `gh-pages` branch**. `.github/workflows/pages.yml` writes there: on every push to `main` the demo deploys to the site root using `JamesIves/github-pages-deploy-action` with `clean-exclude: pr-preview/` and `force: false` (previews untouched, no force-push); each pull request from a branch of this repository publishes under `pr-preview/pr-<number>/` via `rossjrw/pr-preview-action`, commenting the link and cleaning up on close. The demo lives in `demo/`; `npm run build:demo` builds it into `site/` with the commit stamped, and its links and assets are relative so one build works at the root and under preview paths. Fork pull requests get no preview (their token can't push to `gh-pages`).

**Rationale:** Free, with no services or secrets beyond GitHub, and previews live next to the demo they preview; the preview action handles comment, update and cleanup.

**Code:** `.github/workflows/pages.yml`, `scripts/build-demo.mjs`, `demo/index.html`

*Amended by: DL-020, DL-025*

---

### DL-021: Visual identity and demo design: engraved-segno logotype and Swiss grid

- **Logotype (`𝄋egno`):** an inline SVG wordmark where an engraved segno sign (emboldened with a rounded stroke to match the letter stems) serves as the initial capital **S** at cap height, paired with neo-grotesk lowercase `egno` in **Archivo** 500; the S-scroll and slash use `currentColor`, the flanking repeat dots the accent colour; the standalone segno mark is also the favicon.
- **Typography:** Archivo for display and headings (700 for headings); IBM Plex Sans for body copy, disclosures and player controls; IBM Plex Mono for status readouts, technical labels and file names.
- **Palette and layout:** light scheme of cool archival paper (`#f3f4f6`), surface panel, white sheet and stark ink, with Swiss Vermilion (`#cc291b`) for repeat dots, links and `--segno-accent`; a dark scheme (`prefers-color-scheme: dark`) variant with its own ink/surface/sheet and accent values; ink borders on the metadata bar, page sheet and own-export disclosure; controls radius `0.5rem`.

**Rationale:** The musical segno sign evolved from the letter S, so the engraved sign at cap height avoids repeating the initial and inconsistent system-font fallbacks; pairing authentic engraving with Swiss neo-grotesk typography reflects Segno's purpose — playing an engraver's fixed pages inside a modern web component.

**Code:** `demo/index.html`, `docs/logo.svg`, `docs/preview.png`, `README.md`

*Amended by: DL-030*

---

### DL-030: Simplify the demo header framing

*Amends: DL-021*

Remove the decorative double rule above the demo header by deleting `.hero-header::before`. Keep the header bottom divider and the existing logo, typography, colours, score borders and other layout rules unchanged.

**Rationale:** The simpler header better matches the preferred visual balance without changing the rest of the Segno identity.

**Code:** `demo/index.html`

---

## licence

### DL-007: Licensed MIT, with SPDX headers

Everything in the repository is licensed **MIT** (copyright "The Segno contributors"), with contributions accepted under the same licence (inbound = outbound) and no contributor licence agreement. Every source file starts with an SPDX header, a copyright line and a link to the repository; `scripts/check-spdx.mjs` checks the first line in CI, keeping the licence attached to each file when it is copied or bundled on its own. MuseScore code must never be copied into Segno: MuseScore is GPL-3.0-only, while Segno only reads files MuseScore writes.

**Rationale:** GPL v3 was rejected because it discourages closed-source adoption and blocks outside contributions once code is combined under it; MIT lets anyone use, modify and redistribute Segno and is the licence users' legal reviews already know.

**Code:** `LICENSE`, `scripts/check-spdx.mjs`, `package.json` → `license`

*Amended by: DL-025*

---

## open-source

### DL-008: No trademark in names; only open-licensed test scores, listed with their sources

"MuseScore" may appear in descriptions ("for MuseScore exports", "MuseScore's position files") but never in the names of the package, the element, the repository, the CLI or its commands. Fixtures and demo scores must be public domain or open-licensed, each listed in `fixtures/SOURCES.md` with its files, score, source and licence, and carrying whatever attribution the licence requires. Fixtures are exported from the original score file (`.mscz`), not through MusicXML round trips — a round trip of one test score mangled its endings. The first fixture is *När juldagsmorgon glimmar* from Fria Noter (CC BY 4.0): one page, two staves, a pickup bar, and a repeat with 1st and 2nd endings.

**Rationale:** Using a trademark in a name suggests endorsement; using it to describe compatibility does not. Open-licensed fixtures keep the repository redistributable and their sources checkable.

**Code:** `fixtures/SOURCES.md`, `src/test/fixtures.ts` → `fixture`
