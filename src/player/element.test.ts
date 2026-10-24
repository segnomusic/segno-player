// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page as browser } from 'vitest/browser';
import type { SyncMap } from '../core/index.js';
import { type BarChangeDetail, SegnoPlayer } from './index.js';
import { blankPage, fixture, next, revokeAll, silentAudio } from './test-assets.js';

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  document.body.replaceChildren();
  revokeAll();
  vi.restoreAllMocks();
});

function mount(attributes: Record<string, string | true> = {}): SegnoPlayer {
  const player = document.createElement('segno-player');
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value === true ? '' : value);
  document.body.append(player);
  return player;
}

/** A player with the fixture's positions on a blank page, and 30 s of silence: ready to play */
async function ready(attributes: Record<string, string | true> = {}): Promise<SegnoPlayer> {
  const player = mount({
    pages: blankPage(),
    audio: silentAudio(30),
    positions: fixture.mpos,
    notes: fixture.spos,
    ...attributes,
  });
  await next(player, 'canplay');
  return player;
}

async function seek(player: SegnoPlayer, seconds: number): Promise<void> {
  const seeked = next(player, 'seeked');
  player.currentTime = seconds;
  await seeked;
}

const shadow = (player: SegnoPlayer): ShadowRoot => {
  if (!player.shadowRoot) throw new Error('No shadow root');
  return player.shadowRoot;
};
const query = <T extends Element = HTMLElement>(player: SegnoPlayer, selector: string): T => {
  const el = shadow(player).querySelector<T>(selector);
  if (!el) throw new Error(`No ${selector}`);
  return el;
};
const activeMarker = (player: SegnoPlayer): HTMLElement => query(player, '.bar-marker.on');
/** Expects a CSS percentage to be a page fraction */
const expectPercent = (value: string, fraction: number): void => {
  expect(value).toMatch(/%$/);
  expect(Number.parseFloat(value)).toBeCloseTo(fraction * 100, 3);
};
const syncOf = (player: SegnoPlayer): SyncMap => {
  if (!player.sync) throw new Error('No sync map');
  return player.sync;
};
const startOf = (player: SegnoPlayer, event: number): number => (syncOf(player).events[event]?.[1] ?? 0) / 1000;

describe('pages', () => {
  test('shows each page as an image, with alt text', () => {
    const player = mount({ pages: 'a-1.svg  a-2.svg', alt: 'Hosianna' });
    const images = [...shadow(player).querySelectorAll('img')];
    expect(images.map((img) => new URL(img.src).pathname.split('/').at(-1))).toEqual(['a-1.svg', 'a-2.svg']);
    expect(images.map((img) => img.alt)).toEqual(['Hosianna, page 1 of 2', 'Hosianna, page 2 of 2']);
    player.removeAttribute('alt');
    expect(images[0]?.alt).toBe('Page 1 of 2');
    player.setAttribute('pages', 'b-1.svg');
    expect(shadow(player).querySelectorAll('img')).toHaveLength(1);
  });

  test('takes the pages’ aspect ratio from their SVGs', async () => {
    const player = await ready();
    expect(query(player, '.page').style.aspectRatio).toBe('9921.26 / 14031.5');
  });

  test('defines the element once', async () => {
    expect(customElements.get('segno-player')).toBe(SegnoPlayer);
    await import('./index.js');
    expect(customElements.get('segno-player')).toBe(SegnoPlayer);
  });
});

describe('markers', () => {
  test('builds the sync map and marks the first bar before playing', async () => {
    const player = await ready();
    expect(syncOf(player).bars).toHaveLength(13);
    expect(player.currentBar).toBe(0);
    const [, x, y, w, h] = syncOf(player).bars[0] ?? [];
    const marker = activeMarker(player);
    expectPercent(marker.style.left, (x ?? 0) - 0.012);
    expectPercent(marker.style.top, y ?? 0);
    expectPercent(marker.style.width, (w ?? 0) + 0.024);
    expectPercent(marker.style.height, h ?? 0);
    expect(query(player, '.note-cursor').hidden).toBe(false);
  });

  test('moves to the bar being played and fires barchange, for every pass through a repeat', async () => {
    const player = await ready();
    const changes: BarChangeDetail[] = [];
    player.addEventListener('barchange', (e) => changes.push(e.detail));
    await seek(player, startOf(player, 6) + 0.1);
    expect(player.currentBar).toBe(6);
    await seek(player, startOf(player, 12) + 0.1);
    expect(player.currentBar).toBe(6);
    expect(changes).toEqual([
      { bar: 6, event: 6 },
      { bar: 6, event: 12 },
    ]);
    expect(shadow(player).querySelectorAll('.bar-marker.on')).toHaveLength(1);
  });

  test('changes bar slightly before the event, by bar-lead', async () => {
    const player = await ready({ 'bar-lead': '200' });
    await seek(player, startOf(player, 3) - 0.1);
    expect(player.currentBar).toBe(3);
    player.setAttribute('bar-lead', 'nonsense');
    await seek(player, startOf(player, 5) - 0.1);
    expect(player.currentBar).toBe(4);
  });

  test('uses a 15 ms bar lead by default', async () => {
    const player = await ready();
    await seek(player, startOf(player, 3) - 0.02);
    expect(player.currentBar).toBe(2);
    await seek(player, startOf(player, 3) - 0.01);
    expect(player.currentBar).toBe(3);
  });

  test('places the note cursor on the note playing, unless note-cursor is off', async () => {
    const player = await ready();
    const sync = syncOf(player);
    const [note, ms] = sync.noteEvents?.[5] ?? [];
    await seek(player, ((ms ?? 0) + 20) / 1000);
    const cursor = query(player, '.note-cursor');
    expectPercent(cursor.style.left, sync.notes?.[note ?? 0]?.[1] ?? 0);
    player.setAttribute('note-cursor', 'off');
    expect(cursor.hidden).toBe(true);
  });

  test('has no note cursor without an .spos file', async () => {
    const player = await ready({ notes: '' });
    expect(player.sync?.notes).toBeUndefined();
    expect(shadow(player).querySelector('.note-cursor:not([hidden])')).toBeNull();
  });

  test('uses a sync map set on the property', async () => {
    const map: SyncMap = { v: 1, bars: [[0, 0.1, 0.2, 0.3, 0.1]], events: [[0, 0]] };
    const player = mount({ pages: blankPage(), audio: silentAudio(5) });
    player.sync = map;
    await next(player, 'canplay');
    expect(player.sync).toBe(map);
    expectPercent(activeMarker(player).style.left, 0.1 - 0.012);
  });
});

describe('falling back to plain playback', () => {
  test('when the audio ends before the last bar starts', async () => {
    const player = await ready({ audio: silentAudio(5) });
    expect(player.currentBar).toBe(-1);
    expect(player.sync).toBeNull();
    await expect(player.playBar(0)).rejects.toThrow('no markers');
    expect(shadow(player).querySelector('.bar-marker.on:not([hidden])')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/ends before the last bar starts.*Play repeats/));
    query(player, '.pages').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(player.currentTime).toBe(5);
  });

  test('when the positions do not fit the pages', async () => {
    const player = await ready({ pages: blankPage(3000, 4000) });
    expect(player.sync).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Playing without markers: .*outside its page/));
  });

  test('when a sync map has bars on pages that are missing', async () => {
    const player = mount({ pages: blankPage(), audio: silentAudio(5) });
    player.sync = { v: 1, bars: [[1, 0.1, 0.2, 0.3, 0.1]], events: [[0, 0]] };
    await next(player, 'canplay');
    expect(player.sync).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/positions on pages the player wasn't given/));
  });

  test('when a sync map is malformed, and canplay still fires', async () => {
    const player = mount({ pages: blankPage(), audio: silentAudio(5) });
    player.sync = { v: 1, bars: [], events: [null] } as unknown as SyncMap;
    await next(player, 'canplay');
    expect(player.sync).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/\[index, ms\] pairs/));
  });

  test('when a sync map has an unknown version', async () => {
    const player = mount({ pages: blankPage(), audio: silentAudio(5) });
    player.sync = { v: 2 } as unknown as SyncMap;
    await next(player, 'canplay');
    expect(player.sync).toBeNull();
  });
});

describe('the media element API', () => {
  test('plays, pauses and re-dispatches the audio’s events', async () => {
    const player = await ready();
    expect(player.paused).toBe(true);
    expect(player.duration).toBeCloseTo(30, 1);
    const playing = next(player, 'play');
    await player.play();
    await playing;
    expect(player.paused).toBe(false);
    const paused = next(player, 'pause');
    player.pause();
    await paused;
    expect(player.paused).toBe(true);
    expect(query(player, '.live').textContent).toMatch(/^Bar \d+ of 13$/);
    const rate = next(player, 'ratechange');
    player.playbackRate = 0.5;
    await rate;
    expect(player.playbackRate).toBe(0.5);
    expect(player.error).toBeNull();
  });

  test('playBar plays from a bar, in the pass nearest the current position', async () => {
    const player = await ready();
    await seek(player, startOf(player, 12) - 1);
    await player.playBar(6);
    player.pause();
    expect(player.currentTime).toBeGreaterThanOrEqual(startOf(player, 12));
    await expect(player.playBar(99)).rejects.toThrow(RangeError);
  });

  test('pauses when removed from the page, and keeps its place when put back', async () => {
    const player = await ready();
    await seek(player, 10);
    await player.play();
    const fetches = vi.spyOn(window, 'fetch');
    player.remove();
    expect(player.paused).toBe(true);
    document.body.append(player);
    await Promise.resolve();
    expect(player.currentTime).toBeGreaterThanOrEqual(10);
    expect(fetches).not.toHaveBeenCalled();
    expect(player.currentBar).toBeGreaterThan(0);
  });

  test('loads again when put back after being removed mid-load', async () => {
    const player = mount({ pages: blankPage(), audio: silentAudio(30), positions: fixture.mpos });
    await Promise.resolve();
    player.remove();
    document.body.append(player);
    await next(player, 'canplay');
    expect(player.sync?.bars).toHaveLength(13);
  });

  test('a new audio source stops playback and keeps the tempo', async () => {
    const player = await ready({ controls: true });
    player.playbackRate = 0.8;
    await player.play();
    const emptied = next(player, 'emptied');
    player.setAttribute('audio', silentAudio(30));
    await emptied;
    expect(player.paused).toBe(true);
    expect(player.playbackRate).toBe(0.8);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Play');
  });

  test('an element upgraded with its attributes loads its audio once', async () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load');
    const host = document.createElement('div');
    host.innerHTML = `<segno-player pages="${blankPage()}" audio="${silentAudio(30)}" positions="${fixture.mpos}"></segno-player>`;
    document.body.append(host);
    const player = host.querySelector('segno-player');
    if (!player) throw new Error('No player');
    await next(player, 'canplay');
    expect(load).toHaveBeenCalledTimes(1);
  });

  test('an invalid URL does not break the element', async () => {
    const player = mount({ pages: 'http://[bad', audio: silentAudio(30), positions: fixture.mpos });
    await next(player, 'canplay');
    expect(player.sync).toBeNull();
    expect(shadow(player).querySelectorAll('img')).toHaveLength(1);
  });

  test('changing a lead moves the markers at once', async () => {
    const player = await ready();
    await seek(player, startOf(player, 3) - 0.1);
    expect(player.currentBar).toBe(2);
    player.setAttribute('bar-lead', '200');
    expect(player.currentBar).toBe(3);
  });
});

describe('interaction', () => {
  test('clicking a bar plays from it', async () => {
    const player = await ready();
    const [, x, y, w, h] = syncOf(player).bars[4] ?? [];
    const overlay = query(player, '.overlay');
    const rect = overlay.getBoundingClientRect();
    const seeked = next(player, 'seeked');
    const playing = next(player, 'play');
    overlay.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        composed: true,
        clientX: rect.left + ((x ?? 0) + (w ?? 0) / 2) * rect.width,
        clientY: rect.top + ((y ?? 0) + (h ?? 0) / 2) * rect.height,
      }),
    );
    await Promise.all([seeked, playing]);
    expect(player.currentBar).toBe(4);
    player.pause();
    const time = player.currentTime;
    overlay.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, clientX: rect.left + 1, clientY: rect.top + 1 }),
    );
    expect(player.currentTime).toBe(time);
  });

  test('the keyboard plays, pauses and moves between bars', async () => {
    const player = await ready();
    const pages = query(player, '.pages');
    const key = (k: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key: k, cancelable: true });
      pages.dispatchEvent(event);
      return event;
    };
    expect(key('ArrowRight').defaultPrevented).toBe(true);
    expect(player.currentTime).toBeCloseTo(startOf(player, 1), 3);
    key('ArrowRight');
    key('ArrowLeft');
    expect(player.currentTime).toBeCloseTo(startOf(player, 1), 3);
    const playing = next(player, 'play');
    key(' ');
    await playing;
    const paused = next(player, 'pause');
    key('k');
    await paused;
    key('Home');
    expect(player.currentTime).toBe(0);
    expect(key('x').defaultPrevented).toBe(false);
  });

  test('→ stays on the last bar, and modified keys are left to the browser', async () => {
    const player = await ready();
    const pages = query(player, '.pages');
    const last = syncOf(player).events.length - 1;
    await seek(player, startOf(player, last) + 0.2);
    pages.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(player.currentTime).toBeCloseTo(startOf(player, last), 3);
    const back = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, cancelable: true });
    pages.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(false);
    pages.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', repeat: true }));
    expect(player.paused).toBe(true);
    const playing = next(player, 'play');
    pages.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
    await playing;
    player.pause();
  });

  test('→ moves on from a bar whose start the audio rounds down', async () => {
    const player = mount({ pages: blankPage(), audio: silentAudio(5) });
    player.sync = {
      v: 1,
      bars: [0.1, 0.3, 0.5].map((x): [number, number, number, number, number] => [0, x, 0.1, 0.2, 0.1]),
      events: [
        [0, 0],
        [1, 1001],
        [2, 2003],
      ],
    };
    await next(player, 'canplay');
    const pages = query(player, '.pages');
    const times: number[] = [];
    for (let i = 0; i < 2; i++) {
      pages.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      times.push(player.currentTime);
    }
    expect(times[0]).toBeCloseTo(1.001, 3);
    expect(times[1]).toBeCloseTo(2.003, 3);
  });

  test('without markers, the arrow keys move five seconds', async () => {
    const player = mount({ pages: blankPage(), audio: silentAudio(30) });
    await next(player, 'canplay');
    const pages = query(player, '.pages');
    pages.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    pages.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    pages.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(player.currentTime).toBe(5);
  });

  test('follow scrolls a system that is off screen into view', async () => {
    await browser.viewport(800, 600);
    const player = await ready({ follow: true });
    player.style.width = '1400px';
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    await player.play();
    await seek(player, startOf(player, 10) + 0.1);
    await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
    player.pause();
  });
});

describe('controls', () => {
  test('are hidden without the controls attribute', () => {
    const player = mount({ pages: blankPage() });
    expect(getComputedStyle(query(player, '.controls')).display).toBe('none');
    player.setAttribute('controls', '');
    expect(getComputedStyle(query(player, '.controls')).display).toBe('flex');
  });

  test('play, pause, show the time, seek and set the tempo', async () => {
    const player = await ready({ controls: true });
    const button = query<HTMLButtonElement>(player, '.play');
    expect(button.getAttribute('aria-label')).toBe('Play');
    expect(query(player, '.elapsed').textContent).toBe('0:00');
    expect(query(player, '.duration').textContent).toBe('0:30');
    const playing = next(player, 'play');
    button.click();
    await playing;
    expect(button.getAttribute('aria-label')).toBe('Pause');
    const paused = next(player, 'pause');
    button.click();
    await paused;

    const range = query<HTMLInputElement>(player, '.seek');
    const seeked = next(player, 'seeked');
    range.value = '12';
    range.dispatchEvent(new Event('input'));
    await seeked;
    expect(player.currentTime).toBe(12);
    expect(query(player, '.elapsed').textContent).toBe('0:12');
    expect(range.getAttribute('aria-valuetext')).toBe('0:12 of 0:30');

    const slower = query<HTMLButtonElement>(player, '[part="tempo-decrease"]');
    const faster = query<HTMLButtonElement>(player, '[part="tempo-increase"]');
    slower.click();
    await next(player, 'ratechange');
    slower.click();
    await next(player, 'ratechange');
    expect(player.playbackRate).toBe(0.8);
    player.playbackRate = 1.5;
    await next(player, 'ratechange');
    expect(query(player, '.tempo-value').textContent).toBe('150%');
    expect(faster.disabled).toBe(true);
    faster.click();
    expect(player.playbackRate).toBe(1.5);
    player.playbackRate = 1.25;
    await next(player, 'ratechange');
    expect(query(player, '.tempo-value').textContent).toBe('125%');
    expect(faster.disabled).toBe(false);
    faster.click();
    await next(player, 'ratechange');
    expect(player.playbackRate).toBe(1.35);
  });

  test('tempo steps clamp at both limits, including rates set through the API', async () => {
    const player = await ready({ controls: true });
    const slower = query<HTMLButtonElement>(player, '[part="tempo-decrease"]');
    const faster = query<HTMLButtonElement>(player, '[part="tempo-increase"]');
    for (const [rate, button, expected] of [
      [0.55, slower, 0.5],
      [1.45, faster, 1.5],
      [0.25, faster, 0.5],
      [2, slower, 1.5],
    ] as const) {
      player.playbackRate = rate;
      await next(player, 'ratechange');
      button.click();
      await next(player, 'ratechange');
      expect(player.playbackRate).toBe(expected);
    }
    player.playbackRate = 0.5;
    await next(player, 'ratechange');
    expect(slower.disabled).toBe(true);
    slower.click();
    expect(player.playbackRate).toBe(0.5);
  });

  test('back to beginning pauses playback and resets the time, markers and cursor', async () => {
    const player = await ready({ controls: true });
    await seek(player, 12);
    await player.play();
    const seeked = next(player, 'seeked');
    query<HTMLButtonElement>(player, '.restart').click();
    await seeked;
    expect(player.paused).toBe(true);
    expect(player.currentTime).toBe(0);
    expect(player.currentBar).toBe(0);
    expect(query(player, '.elapsed').textContent).toBe('0:00');
    expect(query<HTMLInputElement>(player, '.seek').value).toBe('0');
    expect(query(player, '.note-cursor').hidden).toBe(false);
    await seek(player, 5);
    const again = next(player, 'seeked');
    query<HTMLButtonElement>(player, '.restart').click();
    await again;
    expect(player.currentTime).toBe(0);
  });

  test('disables playback and seeking before metadata and after the audio is removed', async () => {
    const player = mount({ controls: true });
    const controls = ['.play', '.restart', '.seek'].map((s) => query<HTMLButtonElement | HTMLInputElement>(player, s));
    expect(controls.every((c) => c.disabled)).toBe(true);
    player.setAttribute('audio', silentAudio(30));
    await next(player, 'canplay');
    expect(controls.every((c) => !c.disabled)).toBe(true);
    const emptied = next(player, 'emptied');
    player.removeAttribute('audio');
    await emptied;
    expect(controls.every((c) => c.disabled)).toBe(true);
    expect(query(player, '.duration').textContent).toBe('0:00');
  });

  test('follow reflects its attribute and stays in sync with the checkbox and property', () => {
    const player = mount({ controls: true, follow: true });
    const checkbox = query<HTMLInputElement>(player, '.follow input');
    const changed = vi.fn();
    player.addEventListener('followchange', changed);
    expect(player.follow).toBe(true);
    expect(checkbox.checked).toBe(true);
    checkbox.click();
    expect(player.follow).toBe(false);
    expect(player.hasAttribute('follow')).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    player.follow = true;
    expect(checkbox.checked).toBe(true);
    player.setAttribute('follow', 'true');
    expect(changed).toHaveBeenCalledTimes(2);
    player.removeAttribute('follow');
    expect(checkbox.checked).toBe(false);
    player.remove();
    player.setAttribute('follow', '');
    expect(checkbox.checked).toBe(true);
    document.body.append(player);
    expect(player.follow).toBe(true);
  });

  test('the follow checkbox switches automatic scrolling without stopping playback', async () => {
    await browser.viewport(800, 600);
    const player = await ready({ controls: true, follow: true });
    player.style.width = '1400px';
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    await player.play();
    query<HTMLInputElement>(player, '.follow input').click();
    await seek(player, startOf(player, 8) + 0.1);
    expect(scroll).not.toHaveBeenCalled();
    expect(player.paused).toBe(false);
    query<HTMLInputElement>(player, '.follow input').click();
    await seek(player, startOf(player, 10) + 0.1);
    expect(scroll).toHaveBeenCalled();
    player.pause();
  });

  test('narrow settings open and close with accessible state and keyboard focus', async () => {
    const player = mount({ controls: true });
    player.style.width = '390px';
    const button = query<HTMLButtonElement>(player, '.settings-toggle');
    const settings = query(player, '.settings');
    expect(button.getAttribute('aria-controls')).toBe(settings.id);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(getComputedStyle(settings).display).toBe('none');
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(getComputedStyle(settings).display).toBe('flex');
    button.click();
    expect(getComputedStyle(settings).display).toBe('none');
    button.click();
    const slower = query<HTMLButtonElement>(player, '[part="tempo-decrease"]');
    slower.focus();
    const other = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    slower.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    slower.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(getComputedStyle(settings).display).toBe('none');
    expect(shadow(player).activeElement).toBe(button);
    player.style.width = '800px';
    const desktopEsc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    slower.focus();
    slower.dispatchEvent(desktopEsc);
    expect(desktopEsc.defaultPrevented).toBe(false);
    expect(shadow(player).activeElement).toBe(slower);
  });

  test('a site’s own controls replace the built-in ones', async () => {
    const player = mount({ pages: blankPage(), controls: true });
    const own = document.createElement('button');
    own.slot = 'controls';
    player.append(own);
    const slot = query<HTMLSlotElement>(player, 'slot[name="controls"]');
    expect(slot.assignedElements()).toEqual([own]);
  });
});

describe('localization', () => {
  let originalLang: string | null;
  beforeEach(() => {
    originalLang = document.documentElement.getAttribute('lang');
  });
  afterEach(() => {
    if (originalLang === null) document.documentElement.removeAttribute('lang');
    else document.documentElement.setAttribute('lang', originalLang);
  });

  test('translates Swedish controls, accessible names, pages and bar announcements', async () => {
    const player = await ready({ controls: true, lang: 'sv-SE', alt: 'Hosianna' });
    const labels: Record<string, string> = {
      '.controls': 'Spelare',
      '.pages': 'Notbild',
      '.play': 'Spela',
      '.restart': 'Till början',
      '.seek': 'Position',
      '.settings-toggle': 'Uppspelningsinställningar',
      '.mode select': 'Notlayout',
      '.tempo': 'Tempo',
      '[part="tempo-decrease"]': 'Långsammare',
      '[part="tempo-increase"]': 'Snabbare',
    };
    for (const [selector, label] of Object.entries(labels)) {
      expect(query(player, selector).getAttribute('aria-label')).toBe(label);
    }
    expect(query(player, '.follow').textContent).toBe('Följ noterna');
    expect(query(player, '.tempo-value').textContent).toBe('100\u00a0%');
    const options = [...query<HTMLSelectElement>(player, '.mode select').options];
    expect(options.map((option) => option.textContent)).toEqual(['Auto', 'Hela bladet', 'Zoom', 'Anpassad']);
    expect(options.map((option) => option.value)).toEqual(['auto', 'full', 'two-system', 'reflow']);
    expect(query<HTMLImageElement>(player, 'img').alt).toBe('Hosianna, sida 1 av 1');
    expect(query(player, 'canvas').getAttribute('aria-label')).toBe('Hosianna, inzoomad notbild');
    expect(query(player, '.controls').lang).toBe('sv');
    expect(query(player, '.pages').lang).toBe('sv');
    expect(query(player, '.live').lang).toBe('sv');
    expect(player.lang).toBe('sv-SE');
    await seek(player, 12);
    expect(query(player, '.seek').getAttribute('aria-valuetext')).toBe('0:12 av 0:30');
    expect(query(player, '.live').textContent).toMatch(/^Takt \d+ av 13$/);
    await player.play();
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Pausa');
    player.pause();
    player.removeAttribute('alt');
    expect(query<HTMLImageElement>(player, 'img').alt).toBe('Sida 1 av 1');
    expect(query(player, 'canvas').getAttribute('aria-label')).toBe('Inzoomad notbild');
  });

  test('inherits document and nearest ancestor lang, and follows changes to either', async () => {
    document.documentElement.lang = 'sv';
    const player = mount({ controls: true });
    expect(player.hasAttribute('lang')).toBe(false);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    document.documentElement.lang = 'en';
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Play'));
    const wrapper = document.createElement('div');
    wrapper.lang = 'sv-FI';
    document.body.append(wrapper);
    wrapper.append(player);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    document.documentElement.lang = 'sv';
    wrapper.lang = 'en';
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Play'));
    wrapper.removeAttribute('lang');
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela'));
  });

  test('explicit languages override inheritance and English fallback is announced in English', async () => {
    document.documentElement.lang = 'sv';
    const player = mount({ controls: true, lang: 'fr' });
    const other = mount({ controls: true });
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Play');
    expect(player.lang).toBe('fr');
    expect(query(player, '.controls').lang).toBe('en');
    expect(query(player, '.pages').lang).toBe('en');
    expect(query(other, '.play').getAttribute('aria-label')).toBe('Spela');
    player.lang = '';
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Play');
    player.removeAttribute('lang');
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    player.lang = 'en-US';
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Play');
    document.documentElement.lang = 'en';
    await vi.waitFor(() => expect(query(other, '.play').getAttribute('aria-label')).toBe('Play'));
    expect(player.lang).toBe('en-US');
  });

  test('updates inherited namespaced xml:lang and ignores unrelated ancestor attributes', async () => {
    const xml = 'http://www.w3.org/XML/1998/namespace';
    document.documentElement.lang = 'en';
    const wrapper = document.createElement('div');
    document.body.append(wrapper);
    const player = document.createElement('segno-player');
    wrapper.append(player);
    const resolve = vi.spyOn(player, 'matches');
    wrapper.className = 'changed';
    wrapper.style.width = '400px';
    wrapper.setAttributeNS('urn:unrelated', 'other:lang', 'sv');
    await Promise.resolve();
    expect(resolve).not.toHaveBeenCalled();
    wrapper.setAttributeNS(xml, 'xml:lang', 'sv');
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela'));
    wrapper.setAttributeNS(xml, 'xml:lang', 'en');
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Play'));
    wrapper.setAttributeNS(xml, 'xml:lang', 'sv');
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela'));
    wrapper.removeAttributeNS(xml, 'lang');
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Play'));
  });

  test('preserves playback, DOM, focus and open settings when changing language', async () => {
    const player = await ready({ controls: true, follow: true, mode: 'two-system', style: 'width: 400px' });
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    player.playbackRate = 0.8;
    await seek(player, 5);
    const announcement = query(player, '.live').textContent;
    const controls = query(player, '.controls');
    const image = query(player, 'img');
    const canvas = query(player, 'canvas');
    const selector = query<HTMLSelectElement>(player, '.mode select');
    const options = [...selector.options];
    const settingsButton = query<HTMLButtonElement>(player, '.settings-toggle');
    settingsButton.click();
    const slower = query<HTMLButtonElement>(player, '[part="tempo-decrease"]');
    slower.focus();
    await player.play();
    const time = player.currentTime;
    const sync = player.sync;
    const fetches = vi.spyOn(window, 'fetch');
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load');
    const draw = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    player.lang = 'sv';
    expect(query(player, '.controls')).toBe(controls);
    expect(query(player, 'img')).toBe(image);
    expect(query(player, 'canvas')).toBe(canvas);
    expect([...selector.options]).toEqual(options);
    expect(shadow(player).activeElement).toBe(slower);
    expect(settingsButton.getAttribute('aria-expanded')).toBe('true');
    expect(player.mode).toBe('two-system');
    expect(selector.value).toBe('two-system');
    expect(player.resolvedMode).toBe('two-system');
    expect(player.follow).toBe(true);
    expect(query<HTMLInputElement>(player, '.follow input').checked).toBe(true);
    expect(player.playbackRate).toBe(0.8);
    expect(player.paused).toBe(false);
    expect(player.currentTime).toBeGreaterThanOrEqual(time);
    expect(player.sync).toBe(sync);
    expect(fetches).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(draw).not.toHaveBeenCalled();
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Pausa');
    expect(query(player, '.tempo-value').textContent).toBe('80\u00a0%');
    expect(query(player, '.live').textContent).toBe(announcement?.replace('Bar', 'Takt').replace('of', 'av'));
    player.lang = 'en';
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Pause');
    expect(query(player, '.live').textContent).toBe(announcement);
    player.pause();
  });

  test('a language switch does not start bar announcements during playback', async () => {
    const player = await ready({ controls: true });
    expect(query(player, '.live').textContent).toBe('');
    await player.play();
    player.lang = 'sv';
    expect(query(player, '.live').textContent).toBe('');
    const paused = next(player, 'pause');
    player.pause();
    await paused;
    expect(query(player, '.live').textContent).toMatch(/^Takt \d+ av 13$/);
  });

  test('translates the last announcement without announcing a new playback position', async () => {
    const player = await ready();
    await seek(player, 1);
    const announcement = query(player, '.live').textContent;
    await player.play();
    await seek(player, 12);
    expect(query(player, '.live').textContent).toBe(announcement);
    player.lang = 'sv';
    expect(query(player, '.live').textContent).toBe(announcement?.replace('Bar', 'Takt').replace('of', 'av'));
    player.pause();
  });

  test('observes inherited changes across a containing shadow root', async () => {
    document.documentElement.lang = 'en';
    const host = document.createElement('div');
    host.lang = 'sv';
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const player = document.createElement('segno-player');
    root.append(player);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    host.lang = 'en';
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Play'));
    host.removeAttribute('lang');
    document.documentElement.lang = 'sv';
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela'));
  });

  test('rebinds inherited language on state-preserving moves without pausing playback', async () => {
    const swedish = document.createElement('div');
    const english = document.createElement('div');
    swedish.lang = 'sv';
    english.lang = 'en';
    document.body.append(swedish, english);
    const player = await ready({ controls: true });
    await player.play();
    swedish.moveBefore(player, null);
    expect(player.paused).toBe(false);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Pausa');
    english.moveBefore(player, null);
    expect(player.paused).toBe(false);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Pause');
    english.lang = 'sv';
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Pausa'));
    player.pause();
  });

  test('disconnects inherited-language observation and resolves again on reconnect', async () => {
    const wrapper = document.createElement('div');
    wrapper.lang = 'sv';
    document.body.append(wrapper);
    const player = document.createElement('segno-player');
    wrapper.append(player);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    player.remove();
    wrapper.lang = 'en';
    await Promise.resolve();
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    wrapper.append(player);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Play');
    player.remove();
    player.lang = 'sv';
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
  });

  test('resolves again after adoption into another document', () => {
    const player = mount();
    const other = document.implementation.createHTMLDocument('Swedish page');
    other.documentElement.lang = 'sv';
    other.body.append(player);
    expect(player.ownerDocument).toBe(other);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    document.body.append(player);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Play');
  });

  test('observes a shadow host in another window after adoption', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const other = frame.contentDocument;
    if (!other) throw new Error('No iframe document');
    const host = other.createElement('div');
    host.lang = 'sv';
    other.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const player = mount();
    root.append(player);
    expect(query(player, '.play').getAttribute('aria-label')).toBe('Spela');
    host.lang = 'en';
    await vi.waitFor(() => expect(query(player, '.play').getAttribute('aria-label')).toBe('Play'));
    document.body.append(player);
  });

  test('leaves authored titles and slotted custom controls untouched', () => {
    const player = mount({ controls: true, pages: 'a.svg', alt: '<Hosianna>' });
    const own = document.createElement('button');
    own.slot = 'controls';
    own.textContent = 'My own play button';
    own.lang = 'en';
    player.append(own);
    player.lang = 'sv';
    expect(query<HTMLImageElement>(player, 'img').alt).toBe('<Hosianna>, sida 1 av 1');
    expect(own.textContent).toBe('My own play button');
    expect(own.lang).toBe('en');
    expect(query<HTMLSlotElement>(player, 'slot[name="controls"]').assignedElements()).toEqual([own]);
  });

  test('Swedish settings fit narrow players without overflowing', async () => {
    await browser.viewport(1000, 700);
    const player = mount({ controls: true, lang: 'sv' });
    const controls = query(player, '.controls');
    const settings = query<HTMLButtonElement>(player, '.settings-toggle');
    for (const width of [280, 320, 390, 600]) {
      player.style.width = `${width}px`;
      expect(controls.scrollWidth).toBeLessThanOrEqual(controls.clientWidth);
      settings.click();
      expect(controls.scrollWidth).toBeLessThanOrEqual(controls.clientWidth);
      settings.click();
    }
  });
});

describe('theming', () => {
  test('custom properties set on the page reach the markers', async () => {
    const player = await ready();
    player.style.setProperty('--segno-accent', 'rgb(0, 0, 255)');
    player.style.setProperty('--segno-bar-strength', '100%');
    // Chromium writes the color-mix() result in the srgb color() form
    expect(getComputedStyle(activeMarker(player)).backgroundColor).toMatch(/^(rgb\(0, 0, 255\)|color\(srgb 0 0 1\))$/);
  });

  test('the compact preset shows only play and seek, even with open settings', () => {
    const player = mount({ pages: blankPage(), controls: true });
    expect(getComputedStyle(query(player, '.time')).display).not.toBe('none');
    query<HTMLButtonElement>(player, '.settings-toggle').click();
    player.style.setProperty('--segno-controls', 'compact');
    expect(getComputedStyle(query(player, '.time')).display).toBe('none');
    expect(getComputedStyle(query(player, '.restart')).display).toBe('none');
    expect(getComputedStyle(query(player, '.settings')).display).toBe('none');
    expect(getComputedStyle(query(player, '.settings-toggle')).display).toBe('none');
    expect(getComputedStyle(query(player, '.seek')).display).not.toBe('none');
  });

  test('the settings collapse by player width, not viewport width, without overflowing', async () => {
    await browser.viewport(1000, 700);
    const player = mount({ pages: blankPage(), controls: true });
    player.style.width = '800px';
    expect(getComputedStyle(query(player, '.controls')).flexWrap).toBe('nowrap');
    expect(getComputedStyle(query(player, '.settings')).display).toBe('flex');
    expect(getComputedStyle(query(player, '.settings-toggle')).display).toBe('none');
    for (const width of [280, 320, 390, 600]) {
      player.style.width = `${width}px`;
      const bar = query(player, '.controls');
      expect(getComputedStyle(bar).flexWrap).toBe('wrap');
      expect(getComputedStyle(query(player, '.settings')).display).toBe('none');
      expect(getComputedStyle(query(player, '.settings-toggle')).display).toBe('grid');
      expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
      const row = query(player, '.play').getBoundingClientRect();
      for (const selector of ['.restart', '.progress', '.settings-toggle']) {
        expect(query(player, selector).getBoundingClientRect().top).toBeGreaterThanOrEqual(row.top);
        expect(query(player, selector).getBoundingClientRect().bottom).toBeLessThanOrEqual(row.bottom);
      }
      query<HTMLButtonElement>(player, '.settings-toggle').click();
      expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
      query<HTMLButtonElement>(player, '.settings-toggle').click();
    }
    player.style.width = '800px';
    expect(getComputedStyle(query(player, '.settings')).display).toBe('flex');
    player.style.setProperty('--segno-controls', 'compact');
    expect(getComputedStyle(query(player, '.controls')).flexWrap).toBe('nowrap');
  });
});

describe('score modes', () => {
  test('full is the default and invalid values use the default', async () => {
    const player = await ready({ controls: true });
    expect(player.mode).toBe('full');
    expect(player.resolvedMode).toBe('full');
    expect(query(player, '.canvas-view').hidden).toBe(true);
    expect(query<HTMLSelectElement>(player, '.mode select').value).toBe('full');
    player.setAttribute('mode', 'something-else');
    expect(player.mode).toBe('full');
    expect(player.resolvedMode).toBe('full');
  });

  test('the property, attribute, selector and modechange event stay synchronized', async () => {
    const player = await ready({ controls: true, style: 'width: 400px' });
    const selector = query<HTMLSelectElement>(player, '.mode select');
    const changes: string[] = [];
    player.addEventListener('modechange', (event) => changes.push(`${event.detail.mode}:${event.detail.resolvedMode}`));
    player.mode = 'two-system';
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    expect(player.getAttribute('mode')).toBe('two-system');
    expect(selector.value).toBe('two-system');
    expect(selector.selectedOptions[0]?.textContent).toBe('Zoom');
    expect(query(player, '.canvas-view').hidden).toBe(false);
    expect(query(player, '.page').hidden).toBe(true);
    expect(query<HTMLCanvasElement>(player, 'canvas').width).toBeGreaterThan(0);

    selector.value = 'reflow';
    selector.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(player.resolvedMode).toBe('reflow'));
    expect(player.mode).toBe('reflow');
    player.setAttribute('mode', 'full');
    expect(selector.value).toBe('full');
    expect(player.resolvedMode).toBe('full');
    expect(changes).toContain('two-system:two-system');
    expect(changes).toContain('reflow:reflow');
  });

  test('auto follows host width while manual modes stay fixed', async () => {
    await browser.viewport(1000, 700);
    const player = await ready({ mode: 'auto', style: 'width: 500px' });
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    player.style.width = '900px';
    await vi.waitFor(() => expect(player.resolvedMode).toBe('full'));
    player.style.width = '500px';
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    player.mode = 'reflow';
    await vi.waitFor(() => expect(player.resolvedMode).toBe('reflow'));
    player.style.width = '900px';
    await vi.waitFor(() => expect(player.resolvedMode).toBe('reflow'));
    player.mode = 'auto';
    await vi.waitFor(() => expect(player.resolvedMode).toBe('full'));
  });

  test('canvas modes preserve playback state and update on paused seeks without redrawing every time', async () => {
    const draw = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const player = await ready({ mode: 'reflow', style: 'width: 400px' });
    await vi.waitFor(() => expect(player.resolvedMode).toBe('reflow'));
    player.playbackRate = 0.8;
    await seek(player, startOf(player, 1) + 0.1);
    const count = draw.mock.calls.length;
    await seek(player, startOf(player, 2) + 0.2);
    expect(player.currentBar).toBe(2);
    expect(draw.mock.calls.length).toBe(count);
    await player.play();
    const time = player.currentTime;
    player.mode = 'two-system';
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    expect(player.paused).toBe(false);
    expect(player.currentTime).toBeGreaterThanOrEqual(time);
    expect(player.playbackRate).toBe(0.8);
    player.pause();
  });

  test('canvas click-to-play uses the active crop transform', async () => {
    const player = await ready({ mode: 'two-system', style: 'width: 400px' });
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    const marker = activeMarker(player);
    const rect = marker.getBoundingClientRect();
    const playing = next(player, 'play');
    query(player, '.canvas-view .overlay').dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        composed: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
    await playing;
    expect(player.currentBar).toBe(0);
    player.pause();
  });

  test('a prebuilt property map loads multi-page SVGs only for canvas mode', async () => {
    const player = mount({
      pages: `${blankPage()} ${blankPage(5000, 7000)}`,
      audio: silentAudio(5),
      mode: 'two-system',
      style: 'width: 400px',
    });
    player.sync = {
      v: 1,
      bars: [
        [0, 0.1, 0.1, 0.3, 0.1],
        [1, 0.1, 0.1, 0.3, 0.1],
      ],
      events: [
        [0, 0],
        [1, 2000],
      ],
    };
    await next(player, 'canplay');
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    await seek(player, 2.1);
    expect(player.currentBar).toBe(1);
    expect(player.resolvedMode).toBe('two-system');
    expect(activeMarker(player).style.left).toMatch(/px$/);
  });

  test('same-mode resizing updates the bar marker projection', async () => {
    const player = await ready({ mode: 'two-system', style: 'width: 400px' });
    await vi.waitFor(() => expect(player.resolvedMode).toBe('two-system'));
    const before = Number.parseFloat(activeMarker(player).style.width);
    player.style.width = '600px';
    await vi.waitFor(() => expect(Number.parseFloat(activeMarker(player).style.width)).toBeGreaterThan(before));
  });

  test('full score still works when canvas contexts are unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const player = await ready();
    expect(player.resolvedMode).toBe('full');
    expect(player.currentBar).toBe(0);
    player.mode = 'two-system';
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Canvas 2D is not available/)));
    expect(player.resolvedMode).toBe('full');
    expect(player.sync).not.toBeNull();
  });

  test('canvas asset failure falls back to full pages without blocking audio', async () => {
    const player = mount({ pages: '/missing-canvas-page.svg', audio: silentAudio(5), mode: 'reflow' });
    player.sync = { v: 1, bars: [[0, 0.1, 0.1, 0.3, 0.1]], events: [[0, 0]] };
    await next(player, 'canplay');
    await vi.waitFor(() => {
      expect(player.resolvedMode).toBe('full');
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Showing full pages/));
    });
    expect(player.mode).toBe('reflow');
    expect(player.sync).not.toBeNull();
    expect(query(player, '.canvas-view').hidden).toBe(true);
  });
});
