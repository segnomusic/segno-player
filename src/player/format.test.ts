// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { expect, test } from 'vitest';
import { formatTime } from './format.js';

test('formats times as m:ss, and h:mm:ss from an hour', () => {
  expect(formatTime(0)).toBe('0:00');
  expect(formatTime(9.9)).toBe('0:09');
  expect(formatTime(75)).toBe('1:15');
  expect(formatTime(3725)).toBe('1:02:05');
});

test('shows 0:00 for unknown or negative times', () => {
  expect(formatTime(Number.NaN)).toBe('0:00');
  expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  expect(formatTime(-3)).toBe('0:00');
});
