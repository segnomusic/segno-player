// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { describe, expect, test } from 'vitest';
import { tempoBase, tempoRange } from './media.js';

const attributes =
  (values: Record<string, string>) =>
  (name: string): string | null =>
    values[name] ?? null;

describe('tempoRange', () => {
  test('defaults to 50–150% in steps of 10', () => {
    expect(tempoRange(attributes({}), false)).toEqual({ min: 50, max: 150, step: 10 });
  });

  test('takes the attributes, within what the internal audio can play', () => {
    const wide = attributes({ 'tempo-min': '20', 'tempo-max': '300', 'tempo-step': '5' });
    expect(tempoRange(wide, false)).toEqual({ min: 20, max: 300, step: 5 });
    expect(tempoRange(wide, true)).toEqual({ min: 25, max: 200, step: 5 });
    expect(tempoRange(attributes({ 'tempo-min': '250', 'tempo-max': '300' }), true)).toEqual({
      min: 200,
      max: 200,
      step: 10,
    });
  });

  test('falls back to the defaults for values that are not positive numbers, or a range upside down', () => {
    for (const value of ['', ' ', 'fast', '0', '-10', 'Infinity']) {
      expect(tempoRange(attributes({ 'tempo-min': value, 'tempo-step': value }), false)).toEqual({
        min: 50,
        max: 150,
        step: 10,
      });
    }
    expect(tempoRange(attributes({ 'tempo-min': '120', 'tempo-max': '80' }), false)).toEqual({
      min: 50,
      max: 150,
      step: 10,
    });
  });
});

describe('tempoBase', () => {
  test('is a positive number or null', () => {
    expect(tempoBase('72')).toBe(72);
    expect(tempoBase('92.5')).toBe(92.5);
    for (const value of [null, '', 'x', '0', '-1']) expect(tempoBase(value)).toBeNull();
  });
});
