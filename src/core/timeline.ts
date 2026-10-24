// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import type { Bar, Note, SyncMap, TimedEvent } from './sync-map.js';

/** The note cursor: a line through the system at x, as fractions of the page */
export interface NoteCursor {
  page: number;
  x: number;
  y: number;
  h: number;
}

/** What plays at a given time */
export interface Position {
  /** Index into the sync map's `events` */
  event: number;
  /** Index into the sync map's `bars` */
  bar: number;
  page: number;
  /** The bar's `[x, y, w, h]` as fractions of the page */
  box: [x: number, y: number, w: number, h: number];
  /** How far into the bar playback is, 0–1 */
  progress: number;
  /** The note cursor, or null when the sync map has no notes */
  note: NoteCursor | null;
}

export interface Timeline {
  /** Index of the event playing at `ms`, -1 before the first one */
  eventIndexAt(ms: number): number;
  /**
   * The bar playing at `ms`, how far into it playback is, and the note cursor.
   * @param endMs When the last bar ends (the audio's duration); without it the last bar never progresses
   * @returns null when the sync map has no events
   */
  at(ms: number, endMs?: number): Position | null;
  /** The note cursor at `ms`, or null when the sync map has no notes */
  noteAt(ms: number, endMs?: number): NoteCursor | null;
  /** The bar whose box contains a point given as fractions of the page, or -1 */
  barAtPoint(page: number, fx: number, fy: number): number;
  /** Where to seek to play `bar`: the pass closest to `nowMs` when it plays more than once; -1 if never */
  seekTimeForBar(bar: number, nowMs?: number): number;
  readonly bars: readonly Bar[];
  readonly events: readonly TimedEvent[];
}

// The index of the last time at or before `ms` in sorted `times` (-1 before the first)
function lastAtOrBefore(times: number[], ms: number): number {
  let lo = 0;
  let hi = times.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] ?? Infinity) <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

// How far `ms` is from `start` to `end`, 0–1
const fraction = (ms: number, start: number, end: number): number =>
  end > start ? Math.min(1, Math.max(0, (ms - start) / (end - start))) : 0;

// Notes and bars on the same line of music share the page and (nearly) the top
const sameSystem = (a: Bar | Note, b: Bar | Note): boolean => a[0] === b[0] && Math.abs(a[2] - b[2]) < 0.002;

/** Lookups over a sync map for a player, each in O(log n) or better except `barAtPoint` and `seekTimeForBar`. */
export function createTimeline(sync: SyncMap): Timeline {
  const { bars, events, notes = [], noteEvents = [] } = sync;
  const times = events.map((e) => e[1]);
  const noteTimes = noteEvents.map((e) => e[1]);

  // Where the bar holding each note ends: the note cursor runs on to it after the last note of a line,
  // or before a repeat sends playback back
  const barEnd = notes.map((n) => {
    const bar = bars.find((b) => sameSystem(b, n) && n[1] >= b[1] && n[1] < b[1] + b[3]);
    return bar ? bar[1] + bar[3] : n[1];
  });

  const eventIndexAt = (ms: number): number => lastAtOrBefore(times, ms);

  // @decision(DL-009)
  function noteAt(ms: number, endMs?: number): NoteCursor | null {
    const i = Math.max(0, lastAtOrBefore(noteTimes, ms));
    const current = noteEvents[i];
    const note = current && notes[current[0]];
    if (!current || !note) return null;
    const [page, x, y, h] = note;
    const next = noteEvents[i + 1];
    const nextNote = next && notes[next[0]];
    const target = nextNote && sameSystem(nextNote, note) && nextNote[1] > x ? nextNote[1] : (barEnd[current[0]] ?? x);
    const start = current[1];
    const end = next ? next[1] : Math.max(endMs ?? start, start);
    return { page, x: x + (target - x) * fraction(ms, start, end), y, h };
  }

  function at(ms: number, endMs?: number): Position | null {
    const i = eventIndexAt(Math.max(ms, times[0] ?? 0));
    const event = events[i];
    const bar = event && bars[event[0]];
    if (!event || !bar) return null;
    const start = event[1];
    const next = events[i + 1];
    const end = next ? next[1] : Math.max(endMs ?? start, start);
    const [page, x, y, w, h] = bar;
    return {
      event: i,
      bar: event[0],
      page,
      box: [x, y, w, h],
      progress: fraction(ms, start, end),
      note: noteAt(ms, endMs),
    };
  }

  function barAtPoint(page: number, fx: number, fy: number): number {
    return bars.findIndex(([p, x, y, w, h]) => p === page && fx >= x && fx < x + w && fy >= y && fy < y + h);
  }

  // @decision(DL-009)
  function seekTimeForBar(bar: number, nowMs = 0): number {
    let best = -1;
    for (const [b, t] of events) {
      if (b === bar && (best < 0 || Math.abs(t - nowMs) < Math.abs(best - nowMs))) best = t;
    }
    return best;
  }

  return { eventIndexAt, at, noteAt, barAtPoint, seekTimeForBar, bars, events };
}
