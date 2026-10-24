// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/jimutt/segno
/**
 * Segno's core: turns MuseScore's position exports into a sync map and answers what plays when.
 * No dependencies and no DOM, so it runs in Node (at build time) and in the browser.
 * @decision(DL-001) @decision(DL-004)
 * @module
 */
export { parsePositions } from './positions.js';
export { readViewBox } from './svg.js';
export { buildSync, MPOS_UNITS_PER_SVG_UNIT, } from './sync-map.js';
export { createTimeline } from './timeline.js';
//# sourceMappingURL=index.js.map