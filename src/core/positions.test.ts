// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { describe, expect, test } from 'vitest';
import { volta } from '../test/fixtures.js';
import { parsePositions } from './positions.js';
import { readViewBox } from './svg.js';

describe('parsePositions', () => {
  test('parses the elements and events of an .mpos file', () => {
    const { elements, events } = parsePositions(volta.mpos);
    expect(elements).toHaveLength(13);
    expect(events).toHaveLength(17);
    expect(elements[0]).toEqual({ id: '0', x: 13464.5, y: 26393.2, sx: 16788.6, sy: 24486.9, page: 0 });
    expect(events[1]).toEqual({ elid: '1', position: 522 });
  });

  test('parses an .spos file', () => {
    const { elements, events } = parsePositions(volta.spos);
    expect(elements).toHaveLength(33);
    expect(events).toHaveLength(44);
  });

  test('rejects text that is not a positions file', () => {
    expect(() => parsePositions('<score/>')).toThrow('Not a MuseScore positions file');
    expect(() => parsePositions('<svg viewBox="0 0 1 1"></svg>')).toThrow('Not a MuseScore positions file');
    expect(() => parsePositions('<element id="0" x="1" y="2" sx="3"/>')).toThrow('Not a MuseScore positions file');
  });
});

describe('readViewBox', () => {
  test('reads the size from the root svg tag', () => {
    const svg =
      '<?xml version="1.0"?>\n<svg width="210mm" height="297mm" viewBox="0 0 9921.26 14031.5"\n xmlns="http://www.w3.org/2000/svg">';
    expect(readViewBox(svg)).toEqual({ w: 9921.26, h: 14031.5 });
  });

  test('accepts commas between the numbers', () => {
    expect(readViewBox('<svg viewBox=" 0,0, 100,200 ">')).toEqual({ w: 100, h: 200 });
  });

  test('rejects an SVG without a valid viewBox', () => {
    expect(() => readViewBox('<svg width="10">')).toThrow('SVG without a viewBox');
    expect(() => readViewBox('<svg viewBox="0 0 10">')).toThrow('SVG without a viewBox');
    expect(() => readViewBox('<svg viewBox="0 0 10 high">')).toThrow('SVG without a viewBox');
    expect(() => readViewBox('<html></html>')).toThrow('SVG without a viewBox');
  });
});
