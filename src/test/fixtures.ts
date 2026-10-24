// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { readFileSync } from 'node:fs';
import type { PageSize } from '../core/svg.js';

// Exports of open-licensed scores; see fixtures/SOURCES.md
// @decision(DL-008)
export const fixture = (name: string): string =>
  readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8');

/** An A4 page in MuseScore's SVG units */
export const A4: PageSize = { w: 9921.26, h: 14031.5 };

/**
 * "När juldagsmorgon glimmar", exported by MuseScore 4.7: 13 bars on one A4 page, two staves, a pickup bar,
 * and a repeat of bars 6–11 with a 1st ending (bars 10–11) and a 2nd ending (bars 12–13).
 */
export const volta = {
  mpos: fixture('nar-juldagsmorgon-glimmar.mpos'),
  spos: fixture('nar-juldagsmorgon-glimmar.spos'),
  pages: [A4],
};
