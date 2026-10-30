// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

/**
 * Segno's core: turns MuseScore's position exports into a sync map and answers what plays when.
 * No dependencies and no DOM, so it runs in Node (at build time) and in the browser.
 * @decision(DL-001) @decision(DL-004)
 * @module
 */

export { type PositionElement, type PositionEvent, type Positions, parsePositions } from './positions.js';
export { type PageSize, readViewBox } from './svg.js';
export {
  type Bar,
  type BuildSyncOptions,
  buildSync,
  MPOS_UNITS_PER_SVG_UNIT,
  type Note,
  type Page,
  type SyncMap,
  type TimedEvent,
} from './sync-map.js';
export { createTimeline, type NoteCursor, type Position, type Timeline } from './timeline.js';
