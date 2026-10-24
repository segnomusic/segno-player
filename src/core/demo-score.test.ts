// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { expect, test } from 'vitest';
import { fixture } from '../test/fixtures.js';
import { buildSync, readViewBox } from './index.js';

test('the bundled demo exports match, with repeats at the score’s own 103.5 BPM tempo', () => {
  const name = 'nar-juldagsmorgon-glimmar/nar-juldagsmorgon-glimmar';
  const sync = buildSync(fixture(`${name}.mpos`), [readViewBox(fixture(`${name}-1.svg`))], {
    sposXml: fixture(`${name}.spos`),
  });
  expect(sync.bars).toHaveLength(13);
  expect(sync.bars.every(([page]) => page === 0)).toBe(true);
  expect(sync.notes).toHaveLength(33);
  expect(sync.noteEvents).toHaveLength(44);
  expect(sync.events.map(([bar]) => bar)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 5, 6, 7, 8, 11, 12]);

  // Includes the pickup and both endings. The slower tempo is baked into the export, not a playback-rate setting.
  const beats = [0, 1, 5, 9, 13, 16, 17, 21, 25, 27, 29, 32, 33, 37, 41, 43, 45];
  expect(sync.events.map(([, ms]) => ms)).toEqual(beats.map((beat) => Math.round((beat * 60_000) / 103.5)));
});
