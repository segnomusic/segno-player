// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { afterEach, describe, expect, test } from 'vitest';
import { checkSyncMap, loadSync } from './load.js';
import { blankPage, fixture, jsonFile, revokeAll } from './test-assets.js';

afterEach(revokeAll);

const signal = (): AbortSignal => new AbortController().signal;
const inputs = { pages: [] as string[], positions: null, notes: null, sync: null };

describe('checkSyncMap', () => {
  test('accepts a version 1 map', () => {
    const map = { v: 1, bars: [], events: [] };
    expect(checkSyncMap(map)).toBe(map);
  });

  test('rejects anything else', () => {
    expect(() => checkSyncMap(null)).toThrow('must be an object');
    expect(() => checkSyncMap('{}')).toThrow('must be an object');
    expect(() => checkSyncMap({ v: 2, bars: [], events: [] })).toThrow('Unknown sync map version 2');
    expect(() => checkSyncMap({ v: 1, bars: [] })).toThrow('needs bars and their events');
  });

  test('rejects entries of the wrong shape', () => {
    const bars = [[0, 0.1, 0.1, 0.2, 0.1]];
    expect(() => checkSyncMap({ v: 1, bars, events: [null] })).toThrow('[index, ms] pairs');
    expect(() => checkSyncMap({ v: 1, bars, events: [[1, 0]] })).toThrow('[index, ms] pairs');
    expect(() =>
      checkSyncMap({
        v: 1,
        bars,
        events: [
          [0, 5],
          [0, 4],
        ],
      }),
    ).toThrow('in time order');
    expect(() => checkSyncMap({ v: 1, bars: [[0, 0.1]], events: [] })).toThrow('arrays of 5 numbers');
    expect(() => checkSyncMap({ v: 1, bars: [[-1, 0.1, 0.1, 0.2, 0.1]], events: [] })).toThrow('arrays of 5 numbers');
    expect(() => checkSyncMap({ v: 1, bars, events: [[0, 0]], notes: [[0, 0.1, 0.1]], noteEvents: [] })).toThrow(
      'arrays of 4 numbers',
    );
    expect(() => checkSyncMap({ v: 1, bars, events: [[0, 0]], notes: [] })).toThrow('needs notes and their events');
    const withNotes = { v: 1, bars, events: [[0, 0]], notes: [[0, 0.2, 0.1, 0.1]], noteEvents: [[0, 0]] };
    expect(checkSyncMap(withNotes)).toBe(withNotes);
  });
});

describe('loadSync', () => {
  test('builds the map from the positions files and the SVG pages', async () => {
    const result = await loadSync(
      { ...inputs, pages: [blankPage()], positions: fixture.mpos, notes: fixture.spos },
      signal(),
    );
    expect(result.sync?.bars).toHaveLength(13);
    expect(result.sync?.notes).toHaveLength(33);
    expect(result.pageSizes).toEqual([{ w: 9921.26, h: 14031.5 }]);
    expect(result.warnings).toEqual([]);
  });

  test('loads a prebuilt map', async () => {
    const map = { v: 1, bars: [[0, 0.1, 0.1, 0.2, 0.1]], events: [[0, 0]] };
    const result = await loadSync({ ...inputs, sync: jsonFile(map) }, signal());
    expect(result.sync).toEqual(map);
  });

  test('has no map without positions or a map', async () => {
    expect((await loadSync({ ...inputs, pages: [blankPage()] }, signal())).sync).toBeNull();
  });

  test('drops only the note cursor when the notes are missing or do not fit', async () => {
    const missing = await loadSync(
      { ...inputs, pages: [blankPage()], positions: fixture.mpos, notes: '/fixtures/missing.spos' },
      signal(),
    );
    expect(missing.sync?.bars).toHaveLength(13);
    expect(missing.sync?.notes).toBeUndefined();
    expect(missing.warnings[0]).toMatch(/No note cursor: .*404/);

    const wrong = await loadSync(
      { ...inputs, pages: [blankPage()], positions: fixture.mpos, notes: blankPage() },
      signal(),
    );
    expect(wrong.sync?.notes).toBeUndefined();
    expect(wrong.warnings[0]).toMatch(/No note cursor: .*Not a MuseScore positions file/);
  });

  test('fails when the positions do not fit the pages or cannot be loaded', async () => {
    await expect(
      loadSync({ ...inputs, pages: [blankPage(3000, 4000)], positions: fixture.mpos }, signal()),
    ).rejects.toThrow(/outside its page/);
    await expect(loadSync({ ...inputs, pages: [], positions: '/fixtures/missing.mpos' }, signal())).rejects.toThrow(
      /missing\.mpos: HTTP 404/,
    );
    await expect(loadSync({ ...inputs, sync: jsonFile({ v: 9 }) }, signal())).rejects.toThrow(/version 9/);
  });

  test('stops when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadSync(
        { ...inputs, pages: [blankPage()], positions: fixture.mpos, notes: '/fixtures/missing.spos' },
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});
