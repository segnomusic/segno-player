// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { describe, expect, test } from 'vitest';
import { languageOf, messages } from './localization.js';

describe('message catalogs', () => {
  test('have the same complete set of messages and score modes', () => {
    expect(Object.keys(messages.sv)).toEqual(Object.keys(messages.en));
    expect(Object.keys(messages.sv.modes)).toEqual(Object.keys(messages.en.modes));
    for (const text of Object.values(messages)) {
      for (const value of Object.values(text)) {
        if (typeof value === 'string') expect(value.length).toBeGreaterThan(0);
      }
      expect(Object.values(text.modes).every((value) => value.length > 0)).toBe(true);
    }
  });

  test('formats whole English phrases while preserving authored titles', () => {
    const text = messages.en;
    expect(text.seekPosition('0:12', '1:30')).toBe('0:12 of 1:30');
    expect(text.tempoPercent(80)).toBe('80%');
    expect(text.pageDescription(1, 2)).toBe('Page 1 of 2');
    expect(text.pageDescription(2, 2, 'När juldagsmorgon glimmar')).toBe('När juldagsmorgon glimmar, page 2 of 2');
    expect(text.zoomedScore()).toBe('Zoomed score');
    expect(text.zoomedScore('Hosianna')).toBe('Hosianna, zoomed score');
    expect(text.barPosition(4, 13)).toBe('Bar 4 of 13');
  });

  test('formats whole Swedish phrases and non-breaking percent spacing', () => {
    const text = messages.sv;
    expect(text.seekPosition('0:12', '1:30')).toBe('0:12 av 1:30');
    expect(text.tempoPercent(80)).toBe('80\u00a0%');
    expect(text.pageDescription(1, 2)).toBe('Sida 1 av 2');
    expect(text.pageDescription(2, 2, 'När juldagsmorgon glimmar')).toBe('När juldagsmorgon glimmar, sida 2 av 2');
    expect(text.zoomedScore()).toBe('Inzoomad notbild');
    expect(text.zoomedScore('Hosianna')).toBe('Hosianna, inzoomad notbild');
    expect(text.barPosition(4, 13)).toBe('Takt 4 av 13');
  });
});

describe('language resolution', () => {
  test.each([
    ['en', 'en'],
    ['en-GB', 'en'],
    ['sv', 'sv'],
    ['sv-SE', 'sv'],
    ['SV-fi', 'sv'],
    ['fr', 'en'],
    ['se', 'en'],
    ['unknown', 'en'],
    ['', 'en'],
  ] as const)('resolves %j to %s', (tag, expected) => {
    const element = document.createElement('div');
    element.lang = tag;
    expect(languageOf(element)).toBe(expected);
  });
});
