// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { describe, expect, test } from 'vitest';
import { volta } from '../test/fixtures.js';
import { buildSync, type SyncMap, type TimedEvent } from './sync-map.js';
import { createTimeline } from './timeline.js';

const bars = buildSync(volta.mpos, volta.pages);
const withNotes = buildSync(volta.mpos, volta.pages, { sposXml: volta.spos });

// The time of an event, failing the test if it doesn't exist
const timeOf = (events: readonly TimedEvent[] | undefined, i: number): number => {
  const event = events?.at(i);
  if (!event) throw new Error(`No event ${i}`);
  return event[1];
};

describe('at', () => {
  test('finds the bar playing at a time', () => {
    const tl = createTimeline(bars);
    const t1 = timeOf(tl.events, 1);
    expect(tl.at(0)?.bar).toBe(0);
    expect(tl.at(t1 - 1)?.bar).toBe(0);
    expect(tl.at(t1)?.bar).toBe(1);
    expect(tl.at(1e9)?.event).toBe(tl.events.length - 1);
    expect(tl.at(t1)).toMatchObject({ event: 1, page: 0, box: bars.bars[1]?.slice(1) });
  });

  test('plays the first bar before the first event', () => {
    expect(createTimeline(bars).at(-500)).toMatchObject({ event: 0, bar: 0, progress: 0 });
  });

  test('gives how far into the bar playback is', () => {
    const tl = createTimeline(bars);
    const t1 = timeOf(tl.events, 1);
    expect(tl.at(t1 / 2)?.progress).toBe(0.5);
    expect(tl.at(t1)?.progress).toBe(0);
  });

  test('uses the end time for the last bar, which does not progress without one', () => {
    const tl = createTimeline(bars);
    const last = timeOf(tl.events, -1);
    expect(tl.at(last + 500, last + 1000)?.progress).toBe(0.5);
    expect(tl.at(last + 5000, last + 1000)?.progress).toBe(1);
    expect(tl.at(last + 500)?.progress).toBe(0);
    expect(tl.at(last + 500, last - 1000)?.progress).toBe(0);
  });

  test('includes the note cursor when there are notes', () => {
    const tl = createTimeline(withNotes);
    const t = timeOf(withNotes.noteEvents, 1);
    expect(tl.at(t)?.note).toEqual(tl.noteAt(t));
    expect(createTimeline(bars).at(0)?.note).toBeNull();
  });

  test('returns null for a sync map without events', () => {
    const tl = createTimeline({ v: 1, bars: bars.bars, events: [] });
    expect(tl.at(0)).toBeNull();
    expect(tl.eventIndexAt(0)).toBe(-1);
  });
});

describe('eventIndexAt', () => {
  test('finds the last event at or before a time', () => {
    const tl = createTimeline(bars);
    expect(tl.eventIndexAt(-1)).toBe(-1);
    expect(tl.eventIndexAt(0)).toBe(0);
    expect(tl.eventIndexAt(timeOf(tl.events, 5))).toBe(5);
    expect(tl.eventIndexAt(timeOf(tl.events, 5) - 1)).toBe(4);
  });
});

describe('noteAt', () => {
  const tl = createTimeline(withNotes);
  const notes = withNotes.notes ?? [];
  const noteEvents = withNotes.noteEvents ?? [];
  const xOf = (event: number): number => notes[noteEvents[event]?.[0] ?? -1]?.[1] ?? Number.NaN;

  test('flows evenly from one note to the next, arriving as it sounds', () => {
    const [t0, t1] = [timeOf(noteEvents, 0), timeOf(noteEvents, 1)];
    expect(tl.noteAt(t0)?.x).toBe(xOf(0));
    expect(tl.noteAt((t0 + t1) / 2)?.x).toBeCloseTo((xOf(0) + xOf(1)) / 2, 9);
    expect(tl.noteAt(t1)?.x).toBe(xOf(1));
  });

  test('runs on to the end of the bar after the last note of a line, then jumps to the next line', () => {
    const y = (event: number): number => notes[noteEvents[event]?.[0] ?? -1]?.[2] ?? Number.NaN;
    const last = noteEvents.findIndex((_, i) => i + 1 < noteEvents.length && Math.abs(y(i + 1) - y(i)) > 0.002);
    expect(last).toBeGreaterThan(0);
    const [lastT, nextT] = [timeOf(noteEvents, last), timeOf(noteEvents, last + 1)];
    const firstLine = withNotes.bars.filter(([, , by]) => by === withNotes.bars[0]?.[2]);
    const lineEnd = Math.max(...firstLine.map(([, x, , w]) => x + w));
    expect(tl.noteAt(nextT - 0.001)?.x).toBeCloseTo(lineEnd, 4);
    expect(tl.noteAt(lastT + 1)?.x).toBeLessThan(lineEnd);
    expect(tl.noteAt(nextT)?.y).not.toBe(tl.noteAt(lastT)?.y);
  });

  test('runs on to the end of the bar before a repeat jumps back', () => {
    // The last note before the jump from the 1st ending back to bar 6
    const back = noteEvents.findIndex((_, i) => i + 1 < noteEvents.length && xOf(i + 1) < xOf(i));
    const [t, next] = [timeOf(noteEvents, back), timeOf(noteEvents, back + 1)];
    expect(tl.noteAt(next - 0.001)?.x).toBeGreaterThan(xOf(back));
    expect(tl.noteAt(next)?.x).toBe(xOf(back + 1));
    expect(tl.noteAt(t)?.x).toBe(xOf(back));
  });

  test('stays at the first note before it and moves through the last one until the end', () => {
    const last = noteEvents.length - 1;
    const lastT = timeOf(noteEvents, last);
    expect(tl.noteAt(-100)?.x).toBe(xOf(0));
    expect(tl.noteAt(lastT + 1e6)?.x).toBe(xOf(last));
    expect(tl.noteAt(lastT + 500, lastT + 1000)?.x).toBeGreaterThan(xOf(last));
  });

  test('stays at a note that lies outside every bar', () => {
    const sync: SyncMap = {
      v: 1,
      bars: [[0, 0.1, 0.1, 0.2, 0.1]],
      events: [[0, 0]],
      notes: [[0, 0.5, 0.1, 0.1]],
      noteEvents: [[0, 0]],
    };
    expect(createTimeline(sync).noteAt(100, 200)).toEqual({ page: 0, x: 0.5, y: 0.1, h: 0.1 });
  });

  test('is null without notes', () => {
    expect(createTimeline(bars).noteAt(0)).toBeNull();
  });
});

describe('barAtPoint', () => {
  test('finds the bar under a point', () => {
    const tl = createTimeline(bars);
    const [p, x, y, w, h] = tl.bars[3] ?? [];
    if (p === undefined || x === undefined || y === undefined || w === undefined || h === undefined) {
      throw new Error('No bar 4');
    }
    expect(tl.barAtPoint(p, x + w / 2, y + h / 2)).toBe(3);
    expect(tl.barAtPoint(p, x, y)).toBe(3);
    expect(tl.barAtPoint(p, 0.01, 0.01)).toBe(-1);
    expect(tl.barAtPoint(1, x + w / 2, y + h / 2)).toBe(-1);
  });
});

describe('seekTimeForBar', () => {
  test('within a repeat, seeks to the pass closest to the current position', () => {
    const tl = createTimeline(bars);
    const bar7 = 6;
    const [first, second] = tl.events.filter(([b]) => b === bar7).map(([, t]) => t);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(tl.seekTimeForBar(bar7)).toBe(first);
    expect(tl.seekTimeForBar(bar7, 0)).toBe(first);
    expect(tl.seekTimeForBar(bar7, (second ?? 0) - 100)).toBe(second);
    expect(tl.seekTimeForBar(bar7, 1e9)).toBe(second);
  });

  test('is -1 for a bar that never plays', () => {
    expect(createTimeline(bars).seekTimeForBar(99)).toBe(-1);
  });
});
