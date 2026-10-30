// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { describe, expect, test } from 'vitest';
import { A4, volta } from '../test/fixtures.js';
import { buildSync } from './sync-map.js';

describe('buildSync', () => {
  test('builds a sync map in playback order', () => {
    const sync = buildSync(volta.mpos, volta.pages);
    expect(sync.v).toBe(1);
    expect(sync.bars).toHaveLength(13);
    // Bars 6–9 twice, the 1st ending only the first time, the 2nd ending at the end
    expect(sync.events.map(([bar]) => bar + 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 6, 7, 8, 9, 12, 13]);
    expect(sync.events[1]).toEqual([1, 522]);
  });

  test('gives positions as fractions of the page', () => {
    const sync = buildSync(volta.mpos, volta.pages);
    const first = sync.bars[0];
    if (!first) throw new Error('No bars');
    const [page, x, , w, h] = first;
    expect(page).toBe(0);
    // The first bar starts where the staff starts: x 1122.04 in the SVG
    expect(x).toBeCloseTo(1122.04 / A4.w, 4);
    expect(x).toBe(Math.round(x * 1e5) / 1e5);
    for (const [, bx, by, bw, bh] of sync.bars) {
      expect(bx).toBeGreaterThan(0);
      expect(by).toBeGreaterThan(0);
      expect(bx + bw).toBeLessThanOrEqual(1);
      expect(by + bh).toBeLessThanOrEqual(1);
    }
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  test('lists the pages’ sizes, in page order', () => {
    expect(buildSync(volta.mpos, volta.pages).pages).toEqual([[A4.w, A4.h]]);
    expect(buildSync(volta.mpos, [A4, { w: 100, h: 200 }]).pages).toEqual([
      [A4.w, A4.h],
      [100, 200],
    ]);
  });

  test('has no notes without an .spos file', () => {
    const sync = buildSync(volta.mpos, volta.pages);
    expect(sync).not.toHaveProperty('notes');
    expect(sync).not.toHaveProperty('noteEvents');
  });

  test('adds the note positions from an .spos file, each inside a bar of its system', () => {
    const sync = buildSync(volta.mpos, volta.pages, { sposXml: volta.spos });
    expect(sync.notes).toHaveLength(33);
    expect(sync.noteEvents).toHaveLength(44);
    for (const [page, x, y] of sync.notes ?? []) {
      expect(
        sync.bars.some(([p, bx, by, bw]) => p === page && Math.abs(by - y) < 0.002 && x >= bx && x < bx + bw),
      ).toBe(true);
    }
  });

  test('rejects positions in other units than the pages', () => {
    expect(() => buildSync(volta.mpos, volta.pages, { unitsPerSvgUnit: 3 })).toThrow(/Bar 0 falls outside its page/);
    expect(() => buildSync(volta.mpos, [{ w: A4.w, h: A4.h / 4 }])).toThrow(/outside its page/);
    expect(() => buildSync(volta.mpos, volta.pages, { sposXml: volta.spos, unitsPerSvgUnit: 6 })).toThrow(
      /outside its page/,
    );
  });

  test('rejects positions on pages that are missing', () => {
    expect(() => buildSync(volta.mpos, [])).toThrow('Bar 0 is on page 1, but there are only 0 pages');
    const onPage2 = volta.spos.replace('page="0"', 'page="1"');
    expect(() => buildSync(volta.mpos, volta.pages, { sposXml: onPage2 })).toThrow(/^Note \S+ is on page 2/);
  });

  test('rejects files that are not positions files', () => {
    expect(() => buildSync('<score/>', volta.pages)).toThrow('Not a MuseScore positions file');
    expect(() => buildSync(volta.mpos, volta.pages, { sposXml: '<svg/>' })).toThrow('Not a MuseScore positions file');
  });

  test('rejects events for unknown elements', () => {
    const mpos = volta.mpos.replace('<event elid="1"', '<event elid="99"');
    expect(() => buildSync(mpos, volta.pages)).toThrow('Event for unknown bar 99');
    const spos = volta.spos.replace(/<event elid="\d+"/, '<event elid="x"');
    expect(() => buildSync(volta.mpos, volta.pages, { sposXml: spos })).toThrow('Event for unknown note x');
  });

  test('rejects events that go back in time', () => {
    const mpos = volta.mpos.replace('position="522"', 'position="-1"');
    expect(() => buildSync(mpos, volta.pages)).toThrow('Events are not in time order');
  });
});
