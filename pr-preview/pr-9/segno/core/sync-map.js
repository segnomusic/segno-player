// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/jimutt/segno
import { parsePositions } from './positions.js';
/**
 * Positions file units per SVG unit at MuseScore's default PNG resolution: its positions writer scales by
 * `pngDpi / DPI * 12`, and the default `pngDpi` is `DPI`.
 * @decision(DL-002)
 */
export const MPOS_UNITS_PER_SVG_UNIT = 12;
const round = (n) => Math.round(n * 1e5) / 1e5;
// The value at fraction `p` of the sorted values (lower of the two around it)
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)] ?? 0;
// Elements as [page, x, y, w, h] in fractions of their page, checked to lie on it
// @decision(DL-002)
function toPageFractions(elements, pages, unitsPerSvgUnit, what) {
    return elements.map((e) => {
        const page = pages[e.page];
        if (!page)
            throw new Error(`${what} ${e.id} is on page ${e.page + 1}, but there are only ${pages.length} pages`);
        const u = unitsPerSvgUnit;
        const box = [e.page, e.x / u / page.w, e.y / u / page.h, e.sx / u / page.w, e.sy / u / page.h];
        // A box off the page means the units don't match the SVGs (another PNG resolution, other pages)
        const [, x, y, w, h] = box;
        if (x < -0.01 || y < -0.01 || x + w > 1.01 || y + h > 1.01) {
            throw new Error(`${what} ${e.id} falls outside its page: the positions don't match these SVG pages`);
        }
        return box;
    });
}
// Events as [element index, ms], checked to be in time order
function toTimedEvents(events, elements, what) {
    const index = new Map(elements.map((e, i) => [e.id, i]));
    let previous = -Infinity;
    return events.map((e) => {
        const i = index.get(e.elid);
        if (i === undefined)
            throw new Error(`Event for unknown ${what.toLowerCase()} ${e.elid}`);
        if (e.position < previous)
            throw new Error('Events are not in time order');
        previous = e.position;
        return [i, e.position];
    });
}
/**
 * Builds the sync map for a score from its positions files and the sizes of its SVG pages.
 *
 * @param mposXml The .mpos file (bar positions)
 * @param pages The size of each SVG page, in page order (see `readViewBox`)
 * @throws when a file is not a positions file, or the positions don't fit the pages
 */
export function buildSync(mposXml, pages, options = {}) {
    const { sposXml, unitsPerSvgUnit = MPOS_UNITS_PER_SVG_UNIT } = options;
    const mpos = parsePositions(mposXml);
    const sync = {
        v: 1,
        bars: toPageFractions(mpos.elements, pages, unitsPerSvgUnit, 'Bar').map(([page, x, y, w, h]) => [page, round(x), round(y), round(w), round(h)]),
        events: toTimedEvents(mpos.events, mpos.elements, 'Bar'),
    };
    if (sposXml) {
        const spos = parsePositions(sposXml);
        const boxes = toPageFractions(spos.elements, pages, unitsPerSvgUnit, 'Note');
        // @decision(DL-009)
        const notehead = percentile(boxes.map((b) => b[3]), 0.1);
        sync.notes = boxes.map(([page, x, y, , h]) => [page, round(x + notehead / 2), round(y), round(h)]);
        sync.noteEvents = toTimedEvents(spos.events, spos.elements, 'Note');
    }
    return sync;
}
//# sourceMappingURL=sync-map.js.map