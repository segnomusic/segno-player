// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import type { Language } from './localization.js';
import type { ScoreMode } from './mode.js';

/**
 * The attributes of `<segno-player>`, for typing it in JSX and templates (see the README for how to
 * register it with a framework). Values are what the HTML attribute holds: numbers may be given as strings,
 * and boolean attributes are present or absent.
 */
export interface SegnoPlayerAttributes {
  /** The SVG pages' URLs, in page order, separated by spaces */
  pages?: string;
  /** The audio's URL */
  audio?: string;
  /** The `.mpos` file's URL */
  positions?: string;
  /** The `.spos` file's URL, for the note cursor */
  notes?: string;
  /** A prebuilt sync map's URL, instead of `positions` and `notes` */
  sync?: string;
  /** The score's title, for the pages' alt text */
  alt?: string;
  /** Show playback, tempo, score-layout and follow controls */
  controls?: boolean;
  /** Scroll the playing system into view when it leaves the screen in full-score mode */
  follow?: boolean;
  mode?: ScoreMode;
  /** Player language; inherited from the surrounding page when omitted */
  lang?: Language;
  /** Timing offset in ms for the bar marker (positive is early) */
  'bar-lead'?: number | string;
  /** Timing offset in ms for the note cursor (positive is early) */
  'note-lead'?: number | string;
  /** `off` hides the note cursor */
  'note-cursor'?: 'off';
  /** `jump` switches bars at once instead of crossfading */
  'bar-change'?: 'jump';
}
