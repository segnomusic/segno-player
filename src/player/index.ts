// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

/**
 * `<segno-player>`. Importing this module defines the element (once, and only where there is a DOM).
 * @decision(DL-018) @decision(DL-032)
 * @module
 */

import { SegnoPlayer } from './element.js';

// Without a DOM (server rendering, build scripts) importing it does nothing
if (globalThis.customElements && !customElements.get('segno-player')) {
  customElements.define('segno-player', SegnoPlayer);
}

export type { SegnoPlayerAttributes } from './attributes.js';
export { type BarChangeDetail, SegnoPlayer } from './element.js';
export type { ModeChangeDetail, ResolvedScoreMode, ScoreMode } from './mode.js';
