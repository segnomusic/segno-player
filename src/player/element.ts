// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { createTimeline, type SyncMap, type Page as SyncPage, type Timeline } from '../core/index.js';
import { CanvasView } from './canvas-view.js';
import { createControls, type PlayerControls } from './controls.js';
import { checkSyncMap, loadSync } from './load.js';
import { type Language, languageOf, messages } from './localization.js';
import { AUDIO_RATES, type SegnoMedia, tempoBase, tempoRange } from './media.js';
import { automaticMode, type ModeChangeDetail, type ResolvedScoreMode, type ScoreMode, scoreMode } from './mode.js';
import { styles } from './styles.js';

/** `detail` of the `barchange` event */
export interface BarChangeDetail {
  /** Index into the sync map's bars */
  bar: number;
  /** Index into the sync map's events: which pass through the bar */
  event: number;
}

interface Page {
  page: HTMLElement;
  image: HTMLImageElement;
  overlay: HTMLElement;
}

/** Events of the media that the player re-dispatches as its own */
const MEDIA_EVENTS = [
  'play',
  'pause',
  'playing',
  'waiting',
  'seeking',
  'seeked',
  'timeupdate',
  'ratechange',
  'durationchange',
  'loadedmetadata',
  'emptied',
  'ended',
  'error',
] as const;

/** How far the bar marker reaches into the neighbouring bars, as a fraction of the page width */
// @decision(DL-006)
const BAR_OVERLAP = 0.012;
const DEFAULT_BAR_LEAD = 15;
const DEFAULT_NOTE_LEAD = -20;
/** Seeks round a bar's start to the audio's precision; look up events this far ahead so a seek lands in its bar */
const SEEK_TOLERANCE_MS = 1;

const percent = (fraction: number): string => `${(fraction * 100).toFixed(4)}%`;

function numberAttribute(value: string | null, fallback: number): number {
  const n = value === null || value.trim() === '' ? Number.NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Importing the player where there is no DOM (server rendering, build scripts) defines nothing and throws nothing
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

/**
 * `<segno-player>`: plays a score's audio on its engraved SVG pages, with a marker on the bar being played and a
 * cursor that flows from note to note. Its playback API follows `HTMLMediaElement`.
 * @decision(DL-005) @decision(DL-014) @decision(DL-017) @decision(DL-037)
 */
export class SegnoPlayer extends Base {
  static readonly observedAttributes = [
    'pages',
    'audio',
    'positions',
    'notes',
    'sync',
    'alt',
    'note-cursor',
    'bar-lead',
    'note-lead',
    'follow',
    'mode',
    'lang',
    'tempo-min',
    'tempo-max',
    'tempo-step',
    'tempo-base',
  ];

  /** The internal audio, from the `audio` attribute; used unless a host sets `media` */
  readonly #audio = document.createElement('audio');
  #external: SegnoMedia | null = null;
  #mediaListeners = new AbortController();
  #swapping = false;
  readonly #pagesEl = document.createElement('div');
  readonly #live = document.createElement('div');
  readonly #controls: PlayerControls;
  #language: Language = 'en';
  #languageObserver: MutationObserver | null = null;
  #announcement: [bar: number, total: number] | null = null;
  readonly #markers: [HTMLElement, HTMLElement];
  readonly #cursor = document.createElement('div');
  readonly #canvasView = new CanvasView(
    () => this.#refreshMode(),
    (error) => {
      this.#canvasError = true;
      this.#warn(`Showing full pages: ${error instanceof Error ? error.message : String(error)}`);
      this.#refreshMode();
    },
  );
  #pages: Page[] = [];
  #activeMarker = 0;
  #inlineSize = 0;
  #resolvedMode: ResolvedScoreMode = 'full';
  #renderedMode: ResolvedScoreMode = 'full';
  #renderedProjection = -1;
  #notifiedMode: ScoreMode = 'full';
  #canvasError = false;
  #resizeObserver: ResizeObserver | null = null;
  readonly #onWindowResize = (): void => this.#updateSize();

  // What was last applied, so that moving the element or upgrading it redoes only what changed
  #appliedPages: string | null = null;
  #appliedAudio: string | null = null;
  #appliedLoad: string | null = null;

  #syncProperty: SyncMap | null = null;
  #sync: SyncMap | null = null;
  #timeline: Timeline | null = null;
  #lastEventMs = 0;
  #audioTooShort = false;
  #event = -1;
  #bar = -1;

  #load: AbortController | null = null;
  #loadQueued = false;
  #loadSettled = false;
  #audioReady = false;
  #canplayFired = false;
  #frame = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [styles()];

    this.#pagesEl.className = 'pages';
    this.#pagesEl.setAttribute('part', 'pages');
    this.#pagesEl.tabIndex = 0;
    this.#pagesEl.setAttribute('role', 'group');
    this.#pagesEl.lang = 'en';
    this.#pagesEl.setAttribute('aria-label', messages.en.score);
    this.#pagesEl.setAttribute('aria-keyshortcuts', 'Space K ArrowLeft ArrowRight Home');
    this.#pagesEl.addEventListener('click', (e) => this.#onClick(e));
    this.#pagesEl.addEventListener('keydown', (e) => this.#onKey(e));

    const marker = (): HTMLElement => {
      const el = document.createElement('div');
      el.className = 'bar-marker';
      el.setAttribute('part', 'bar-marker');
      el.hidden = true;
      return el;
    };
    this.#markers = [marker(), marker()];
    this.#cursor.className = 'note-cursor';
    this.#cursor.setAttribute('part', 'note-cursor');
    this.#cursor.hidden = true;

    const controlsArea = document.createElement('div');
    controlsArea.className = 'controls-area';
    controlsArea.setAttribute('part', 'controls-area');
    const slot = document.createElement('slot');
    slot.name = 'controls';
    this.#controls = createControls(this, () => ({
      ...tempoRange((name) => this.getAttribute(name), !this.#external),
      base: tempoBase(this.getAttribute('tempo-base')),
    }));
    slot.append(this.#controls.root);
    controlsArea.append(slot);

    this.#live.className = 'live';
    this.#live.lang = 'en';
    this.#live.setAttribute('aria-live', 'polite');

    root.append(this.#pagesEl, controlsArea, this.#live);

    const audio = this.#audio;
    audio.preload = 'metadata';
    audio.preservesPitch = true;
    // iOS before 17.2
    // @decision(DL-038)
    (audio as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    this.#listen(audio);
  }

  /** The media in use: the host's, or the internal audio */
  get #media(): SegnoMedia {
    return this.#external ?? this.#audio;
  }

  /** Follows a media, until the next call */
  // @decision(DL-037)
  #listen(media: SegnoMedia): void {
    this.#mediaListeners.abort();
    this.#mediaListeners = new AbortController();
    const on = (type: string, listener: () => void): void =>
      media.addEventListener(type, listener, { signal: this.#mediaListeners.signal });
    on('canplay', () => {
      this.#audioReady = true;
      this.#maybeCanPlay();
    });
    on('durationchange', () => this.#checkAudioLength());
    on('play', () => this.#startLoop());
    on('pause', () => {
      this.#stopLoop();
      this.#update();
      this.#announce();
    });
    // A new source stops playback without a pause event
    on('emptied', () => {
      this.#stopLoop();
      this.#update();
    });
    on('seeked', () => {
      this.#update();
      if (media.paused && !this.#swapping) this.#announce();
    });
    on('timeupdate', () => {
      if (media.paused) this.#update();
    });
    // After the player's own handlers, so its state is current when the page hears the event
    for (const type of MEDIA_EVENTS) on(type, () => this.dispatchEvent(new Event(type)));
  }

  connectedCallback(): void {
    this.#upgrade('sync');
    this.#upgrade('media');
    // @decision(DL-037)
    if (this.#external && this.#mediaListeners.signal.aborted) this.#listen(this.#external);
    this.#observeLanguage();
    this.#apply();
    this.#resizeObserver ??= new ResizeObserver(() => this.#updateSize());
    this.#resizeObserver.observe(this);
    window.addEventListener('resize', this.#onWindowResize);
    this.#updateSize();
  }

  disconnectedCallback(): void {
    this.#media.pause();
    // A host's media outlives the element; the internal audio doesn't
    if (this.#external) this.#mediaListeners.abort();
    this.#stopLoop();
    this.#resizeObserver?.disconnect();
    this.#languageObserver?.disconnect();
    window.removeEventListener('resize', this.#onWindowResize);
    this.#canvasView.cancelLoading();
    if (!this.#loadSettled) {
      // Load again when connected again
      this.#load?.abort();
      this.#appliedLoad = null;
    }
  }

  /** Takes a property set before the element was defined, which hides the accessor */
  #upgrade(name: 'sync' | 'media'): void {
    if (!Object.hasOwn(this, name)) return;
    const own = this as unknown as Record<string, unknown>;
    const value = own[name];
    delete own[name];
    if (name === 'sync') this.sync = value as SyncMap | null;
    else this.media = value as SegnoMedia | null;
  }

  #updateSize(): void {
    this.#inlineSize = this.getBoundingClientRect().width;
    this.#canvasView.resize(this.#inlineSize);
    this.#refreshMode();
  }

  /** Moving the element with `moveBefore()` keeps it playing */
  connectedMoveCallback(): void {
    this.#observeLanguage();
  }

  adoptedCallback(): void {
    if (this.isConnected) this.#observeLanguage();
  }

  attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
    if (previous === value) return;
    if (name === 'lang') {
      this.#updateLanguage();
      return;
    }
    if (name === 'follow') {
      if ((previous === null) !== (value === null)) this.dispatchEvent(new Event('followchange'));
      return;
    }
    if (name.startsWith('tempo-')) {
      this.#controls.refresh();
      return;
    }
    if (!this.isConnected) return;
    if (name === 'alt') this.#updateAlt();
    else if (name === 'mode') {
      this.#canvasError = false;
      this.#refreshMode();
    } else if (name === 'note-cursor' || name === 'bar-lead' || name === 'note-lead') this.#update();
    else this.#apply();
  }

  // @decision(DL-028)
  #observeLanguage(): void {
    this.#languageObserver ??= new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.attributeName === 'lang' &&
            (record.attributeNamespace === null ||
              record.attributeNamespace === 'http://www.w3.org/XML/1998/namespace'),
        )
      ) {
        this.#updateLanguage();
      }
    });
    this.#languageObserver.disconnect();
    let ancestor: Element = this;
    while (true) {
      const root = ancestor.getRootNode();
      const parent = ancestor.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null);
      if (!parent) break;
      this.#languageObserver.observe(parent, { attributes: true });
      ancestor = parent;
    }
    this.#updateLanguage();
  }

  // @decision(DL-029)
  #updateLanguage(): void {
    const language = languageOf(this);
    if (language === this.#language) return;
    this.#language = language;
    this.#pagesEl.lang = this.#live.lang = language;
    this.#pagesEl.setAttribute('aria-label', messages[language].score);
    this.#controls.setLanguage(language);
    this.#updateAlt();
    if (this.#announcement) this.#live.textContent = messages[language].barPosition(...this.#announcement);
  }

  // The media element API

  get currentTime(): number {
    return this.#media.currentTime;
  }
  set currentTime(seconds: number) {
    this.#media.currentTime = seconds;
  }
  get duration(): number {
    return this.#media.duration;
  }
  get paused(): boolean {
    return this.#media.paused;
  }
  get playbackRate(): number {
    return this.#media.playbackRate;
  }
  set playbackRate(rate: number) {
    this.#setRate(this.#media, rate);
  }
  /** The media's error, as on a media element */
  get error(): MediaError | null {
    return this.#media.error;
  }
  play(): Promise<void> {
    return this.#media.play();
  }
  pause(): void {
    this.#media.pause();
  }

  // @decision(DL-038)
  #setRate(media: SegnoMedia, rate: number): void {
    const playable = media === this.#audio ? Math.min(AUDIO_RATES.max, Math.max(AUDIO_RATES.min, rate)) : rate;
    // The default rate survives a new audio source
    media.defaultPlaybackRate = playable;
    media.playbackRate = playable;
  }

  /**
   * The host's media, playing in place of the internal audio from the `audio` attribute; null while that is in use.
   * Setting it keeps the position, the tempo and whether it plays; null goes back to the internal audio.
   * @decision(DL-037)
   */
  get media(): SegnoMedia | null {
    return this.#external;
  }
  set media(media: SegnoMedia | null) {
    const previous = this.#media;
    const next = media ?? this.#audio;
    this.#external = media;
    if (next === previous) return;
    this.#listen(next);
    // The old media's place; one that failed may throw or have none
    let time = 0;
    let rate = 1;
    let playing = false;
    try {
      time = previous.currentTime;
      rate = previous.playbackRate;
      playing = !previous.paused;
      previous.pause();
    } catch {}
    this.#stopLoop();
    this.#swapping = true;
    try {
      // A change to the audio attribute while the host's media played
      if (!media && this.isConnected) this.#applyAudio();
      this.#audioReady = Number.isFinite(next.duration);
      this.#canplayFired = false;
      next.currentTime = Number.isFinite(time) ? time : 0;
      this.#setRate(next, Number.isFinite(rate) && rate > 0 ? rate : 1);
      if (playing) {
        Promise.resolve(next.play()).catch(() => {});
        // A media that was already playing fires no play event
        if (!next.paused) this.#startLoop();
      } else next.pause();
    } finally {
      this.#swapping = false;
      this.#checkAudioLength();
      this.#controls.refresh();
      this.#maybeCanPlay();
    }
  }

  // What Segno adds

  /** Whether playback scrolls the score into view; reflects the boolean `follow` attribute. */
  get follow(): boolean {
    return this.hasAttribute('follow');
  }
  set follow(value: boolean) {
    this.toggleAttribute('follow', value);
  }

  /** The requested score view; reflects the `mode` attribute. */
  // @decision(DL-024)
  get mode(): ScoreMode {
    return scoreMode(this.getAttribute('mode'));
  }

  set mode(value: ScoreMode) {
    this.setAttribute('mode', value);
  }

  /** The score view currently displayed, with automatic selection resolved. */
  get resolvedMode(): ResolvedScoreMode {
    return this.#resolvedMode;
  }

  /** The bar being played, as an index into the sync map's bars; -1 without markers */
  get currentBar(): number {
    return this.#bar;
  }

  /**
   * The sync map in use: the one set on this property, or the one loaded from the attributes. null while there
   * are no markers: before it has loaded, when it failed, or when the audio is too short for it.
   */
  get sync(): SyncMap | null {
    return this.#markersOn() ? this.#sync : null;
  }
  set sync(map: SyncMap | null) {
    this.#syncProperty = map;
    this.#appliedLoad = null;
    this.#apply();
  }

  /** Plays from a bar; inside repeats, from the pass nearest the current position. */
  playBar(bar: number): Promise<void> {
    const timeline = this.#markersOn();
    if (!timeline) return Promise.reject(new Error('There are no markers to play a bar by'));
    const ms = timeline.seekTimeForBar(bar, this.currentTime * 1000);
    if (ms < 0) return Promise.reject(new RangeError(`Bar ${bar} is never played`));
    this.currentTime = ms / 1000;
    return this.play();
  }

  /** The timeline, when the markers are on */
  #markersOn(): Timeline | null {
    return this.#audioTooShort ? null : this.#timeline;
  }

  // Applying the attributes

  #apply(): void {
    const pages = this.getAttribute('pages') ?? '';
    if (pages !== this.#appliedPages) {
      this.#appliedPages = pages;
      this.#renderPages();
    }
    this.#applyAudio();
    const load = JSON.stringify([pages, ...['positions', 'notes', 'sync'].map((a) => this.getAttribute(a))]);
    if (load !== this.#appliedLoad) {
      this.#appliedLoad = load;
      this.#queueLoad();
    }
  }

  // @decision(DL-037)
  #applyAudio(): void {
    const audio = this.getAttribute('audio');
    if (!this.#external && audio !== this.#appliedAudio) {
      this.#appliedAudio = audio;
      this.#setAudioSource(audio);
    }
  }

  // Pages

  #pageUrls(): string[] {
    return (this.getAttribute('pages') ?? '').split(/\s+/).filter(Boolean);
  }

  #renderPages(): void {
    for (const marker of [...this.#markers, this.#cursor]) {
      marker.remove();
      marker.hidden = true;
    }
    this.#pages = this.#pageUrls().map((url) => {
      const page = document.createElement('div');
      page.className = 'page';
      page.setAttribute('part', 'page');
      const image = document.createElement('img');
      image.setAttribute('part', 'page-image');
      image.decoding = 'async';
      image.src = url;
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      page.append(image, overlay);
      return { page, image, overlay };
    });
    this.#pagesEl.replaceChildren(...this.#pages.map((p) => p.page), this.#canvasView.root);
    this.#updateAlt();
    this.#event = -1;
    this.#bar = -1;
    this.#canvasError = false;
    this.#canvasView.setScore(this.#pageUrls(), []);
  }

  #updateAlt(): void {
    const alt = this.getAttribute('alt') ?? undefined;
    const text = messages[this.#language];
    this.#canvasView.setLabel(text.zoomedScore(alt));
    const count = this.#pages.length;
    this.#pages.forEach(({ image }, i) => {
      image.alt = text.pageDescription(i + 1, count, alt);
    });
  }

  // @decision(DL-014) @decision(DL-036)
  #setPageSizes(sizes: SyncPage[]): void {
    this.#pages.forEach(({ page }, i) => {
      const size = sizes[i];
      page.style.aspectRatio = size ? `${size[0]} / ${size[1]}` : '';
    });
  }

  // Score views

  // @decision(DL-022) @decision(DL-024)
  #refreshMode(): void {
    const mode = this.mode;
    let desired = mode === 'auto' ? automaticMode(this.#inlineSize) : mode;
    if (desired !== 'full' && (!this.#markersOn() || this.#canvasError)) desired = 'full';
    if (desired !== 'full') {
      this.#canvasView.resize(this.#inlineSize);
      this.#canvasView.setScore(this.#pageUrls(), this.#sync?.bars ?? []);
      this.#canvasView.setMode(desired, this.#bar);
      this.#canvasView.update(this.#bar);
      if (!this.#canvasView.ready) desired = 'full';
    }
    const changed = desired !== this.#resolvedMode;
    this.#resolvedMode = desired;
    const canvas = desired !== 'full';
    this.#canvasView.root.hidden = !canvas;
    for (const page of this.#pages) page.page.hidden = canvas;
    this.#pagesEl.setAttribute('data-mode', desired);
    this.#update();
    if (mode !== this.#notifiedMode || changed) {
      this.#notifiedMode = mode;
      this.dispatchEvent(new CustomEvent<ModeChangeDetail>('modechange', { detail: { mode, resolvedMode: desired } }));
    }
  }

  // Loading

  #setAudioSource(src: string | null): void {
    this.#stopLoop();
    this.#audioReady = false;
    this.#canplayFired = false;
    this.#audioTooShort = false;
    if (src) this.#audio.src = src;
    else this.#audio.removeAttribute('src');
    this.#audio.load();
  }

  #queueLoad(): void {
    if (this.#loadQueued) return;
    this.#loadQueued = true;
    queueMicrotask(() => {
      this.#loadQueued = false;
      void this.#loadSync();
    });
  }

  async #loadSync(): Promise<void> {
    this.#load?.abort();
    const load = new AbortController();
    this.#load = load;
    this.#loadSettled = false;
    this.#canplayFired = false;
    this.#setTimeline(null, null);
    let sync: SyncMap | null = null;
    let timeline: Timeline | null = null;
    try {
      if (this.#syncProperty) {
        sync = checkSyncMap(this.#syncProperty);
      } else {
        const result = await loadSync(
          {
            pages: this.#pageUrls(),
            positions: this.getAttribute('positions'),
            notes: this.getAttribute('notes'),
            sync: this.getAttribute('sync'),
          },
          load.signal,
        );
        if (load.signal.aborted) return;
        for (const warning of result.warnings) this.#warn(warning);
        sync = result.sync;
      }
      const pages = this.#pages.length;
      // @decision(DL-036)
      if (sync?.pages && sync.pages.length !== pages) {
        throw new Error(`The sync map was built for ${sync.pages.length} pages, but the player was given ${pages}`);
      }
      if (sync && [...sync.bars, ...(sync.notes ?? [])].some(([page]) => page >= pages)) {
        throw new Error(`The sync map has positions on pages the player wasn't given (${pages} pages)`);
      }
      timeline = sync ? createTimeline(sync) : null;
    } catch (error) {
      if (load.signal.aborted) return;
      this.#warn(`Playing without markers: ${error instanceof Error ? error.message : String(error)}`);
      sync = null;
      timeline = null;
    }
    this.#setPageSizes(sync?.pages ?? []);
    this.#setTimeline(sync, timeline);
    this.#loadSettled = true;
    this.#maybeCanPlay();
  }

  #setTimeline(sync: SyncMap | null, timeline: Timeline | null): void {
    this.#sync = sync;
    this.#timeline = timeline;
    this.#canvasError = false;
    this.#lastEventMs = sync?.events.at(-1)?.[1] ?? 0;
    this.#event = -1;
    this.#bar = -1;
    this.#checkAudioLength();
  }

  #checkAudioLength(): void {
    const duration = this.#media.duration;
    const tooShort = this.#timeline !== null && Number.isFinite(duration) && duration * 1000 < this.#lastEventMs;
    if (tooShort && !this.#audioTooShort) {
      this.#warn(
        `Playing without markers: the audio (${duration.toFixed(1)} s) ends before the last bar starts ` +
          `(${(this.#lastEventMs / 1000).toFixed(1)} s). Was "Play repeats" off when it was exported?`,
      );
    }
    this.#audioTooShort = tooShort;
    this.#refreshMode();
  }

  #maybeCanPlay(): void {
    if (this.#audioReady && this.#loadSettled && !this.#canplayFired) {
      this.#canplayFired = true;
      this.dispatchEvent(new Event('canplay'));
    }
  }

  #warn(message: string): void {
    console.warn(`<segno-player>: ${message}`);
  }

  // Following the audio

  #startLoop(): void {
    const tick = (): void => {
      this.#update();
      this.#frame = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(tick);
  }

  #stopLoop(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  /** Moves the markers to where the audio is */
  #update(): void {
    const timeline = this.#markersOn();
    this.#pagesEl.toggleAttribute('data-markers', timeline !== null);
    if (!timeline) {
      for (const el of [...this.#markers, this.#cursor]) el.hidden = true;
      this.#event = -1;
      this.#bar = -1;
      return;
    }
    const media = this.#media;
    const rate = media.playbackRate || 1;
    const ms = media.currentTime * 1000;
    const endMs = Number.isFinite(media.duration) ? media.duration * 1000 : undefined;
    const barLead = numberAttribute(this.getAttribute('bar-lead'), DEFAULT_BAR_LEAD);
    const noteLead = numberAttribute(this.getAttribute('note-lead'), DEFAULT_NOTE_LEAD);

    const now = timeline.at(ms + barLead * rate, endMs);
    const note = this.getAttribute('note-cursor') === 'off' ? null : timeline.noteAt(ms + noteLead * rate, endMs);
    const eventChanged = now !== null && now.event !== this.#event;
    const changedBar = now !== null && now.bar !== this.#bar;
    if (now) {
      this.#event = now.event;
      this.#bar = now.bar;
    }
    const viewChanged = this.#renderedMode !== this.#resolvedMode;
    if (this.#resolvedMode !== 'full') this.#canvasView.update(this.#bar);
    const projection = this.#resolvedMode === 'full' ? -1 : this.#canvasView.projectionVersion;
    const projectionChanged = projection !== this.#renderedProjection;
    if (now && (changedBar || viewChanged || projectionChanged)) this.#placeBar(now.page, now.box, changedBar);
    if (now && eventChanged) {
      this.dispatchEvent(new CustomEvent<BarChangeDetail>('barchange', { detail: { bar: now.bar, event: now.event } }));
      if (!media.paused && this.#resolvedMode === 'full') this.#follow();
    }

    const cursor = this.#cursor;
    const overlay = this.#resolvedMode === 'full' ? this.#pages[note?.page ?? -1]?.overlay : this.#canvasView.overlay;
    const rect = note && this.#resolvedMode !== 'full' ? this.#canvasView.projectNote(note) : null;
    cursor.hidden = !note || !overlay || (this.#resolvedMode !== 'full' && !rect);
    if (note && overlay && !cursor.hidden) {
      if (cursor.parentElement !== overlay) overlay.append(cursor);
      if (rect) {
        cursor.style.left = `${rect.x}px`;
        cursor.style.top = `${rect.y}px`;
        cursor.style.height = `${rect.h}px`;
      } else {
        cursor.style.left = percent(note.x);
        cursor.style.top = percent(note.y);
        cursor.style.height = percent(note.h);
      }
    }
    this.#renderedMode = this.#resolvedMode;
    this.#renderedProjection = projection;
  }

  /** Places the bar marker, crossfading only when playback changes bars. */
  // @decision(DL-006) @decision(DL-023)
  #placeBar(page: number, [x, y, w, h]: [number, number, number, number], crossfade = true): void {
    const previous = this.#markers[this.#activeMarker];
    if (crossfade) this.#activeMarker = 1 - this.#activeMarker;
    const next = this.#markers[this.#activeMarker];
    const overlay = this.#resolvedMode === 'full' ? this.#pages[page]?.overlay : this.#canvasView.overlay;
    const rect = this.#resolvedMode === 'full' ? null : this.#canvasView.projectBar(this.#bar, page, [x, y, w, h]);
    if (!previous || !next || !overlay || (this.#resolvedMode !== 'full' && !rect)) {
      for (const marker of this.#markers) marker.hidden = true;
      return;
    }
    if (crossfade) previous.classList.remove('on');
    else {
      const other = this.#markers[1 - this.#activeMarker];
      if (other) {
        other.classList.remove('on');
        other.hidden = true;
      }
    }
    if (next.parentElement !== overlay) overlay.append(next);
    const width = w + 2 * BAR_OVERLAP;
    if (rect) {
      const scaleX = rect.w / w;
      Object.assign(next.style, {
        left: `${rect.x - BAR_OVERLAP * scaleX}px`,
        top: `${rect.y}px`,
        width: `${rect.w + 2 * BAR_OVERLAP * scaleX}px`,
        height: `${rect.h}px`,
      });
    } else {
      Object.assign(next.style, {
        left: percent(x - BAR_OVERLAP),
        top: percent(y),
        width: percent(width),
        height: percent(h),
      });
    }
    next.style.setProperty('--fade', percent(BAR_OVERLAP / width));
    next.hidden = false;
    next.classList.add('on');
  }

  /** With `follow`, scrolls the playing system into view when it leaves the viewport */
  #follow(): void {
    const marker = this.#markers[this.#activeMarker];
    if (!this.hasAttribute('follow') || !marker?.isConnected) return;
    const rect = marker.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    marker.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  // Interaction

  /** Clicking a bar plays from it */
  #onClick(event: MouseEvent): void {
    const timeline = this.#markersOn();
    if (!timeline) return;
    if (this.#resolvedMode !== 'full') {
      const point = this.#canvasView.hitTest(event.clientX, event.clientY);
      const bar = point ? timeline.barAtPoint(point.page, point.x, point.y) : -1;
      if (bar >= 0) this.playBar(bar).catch(() => {});
      return;
    }
    const index = this.#pages.findIndex(({ page }) => event.composedPath().includes(page));
    const page = this.#pages[index];
    if (!page) return;
    const rect = page.overlay.getBoundingClientRect();
    const bar = timeline.barAtPoint(
      index,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
    if (bar >= 0) this.playBar(bar).catch(() => {});
  }

  // @decision(DL-016)
  #onKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const timeline = this.#markersOn();
    // The event playing, looked up a little ahead so that a seek to an event's start counts as that event
    const current = (): number => timeline?.eventIndexAt(this.currentTime * 1000 + SEEK_TOLERANCE_MS) ?? -1;
    const seekToEvent = (i: number): void => {
      const target = timeline?.events[Math.min(Math.max(0, i), timeline.events.length - 1)];
      if (target) this.currentTime = target[1] / 1000;
    };
    switch (event.key.toLowerCase()) {
      case ' ':
      case 'k':
        if (!event.repeat) {
          if (this.paused) this.play().catch(() => {});
          else this.pause();
        }
        break;
      case 'arrowright':
        if (timeline) seekToEvent(current() + 1);
        else this.currentTime += 5;
        break;
      case 'arrowleft':
        if (timeline) seekToEvent(current() - 1);
        else this.currentTime = Math.max(0, this.currentTime - 5);
        break;
      case 'home':
        this.currentTime = 0;
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  /** Tells screen readers where playback is: on pause and after seeking, never during playback */
  #announce(): void {
    const timeline = this.#markersOn();
    if (this.#bar < 0 || !timeline) return;
    this.#announcement = [this.#bar + 1, timeline.bars.length];
    this.#live.textContent = messages[this.#language].barPosition(...this.#announcement);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'segno-player': SegnoPlayer;
  }
  interface HTMLElementEventMap {
    barchange: CustomEvent<BarChangeDetail>;
    modechange: CustomEvent<ModeChangeDetail>;
  }
}
