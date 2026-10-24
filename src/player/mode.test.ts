// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { describe, expect, test } from 'vitest';
import { AUTO_TABLET_WIDTH, automaticMode, scoreMode } from './mode.js';

describe('score modes', () => {
  test('defaults to full score and accepts every public mode', () => {
    expect(scoreMode(null)).toBe('full');
    expect(scoreMode('invalid')).toBe('full');
    expect(scoreMode('')).toBe('full');
    expect(scoreMode('full')).toBe('full');
    expect(scoreMode('two-system')).toBe('two-system');
    expect(scoreMode('reflow')).toBe('reflow');
    expect(scoreMode('auto')).toBe('auto');
  });

  test('auto resolves by container width', () => {
    expect(automaticMode(AUTO_TABLET_WIDTH - 1)).toBe('two-system');
    expect(automaticMode(AUTO_TABLET_WIDTH)).toBe('full');
    expect(automaticMode(0)).toBe('full');
  });
});
