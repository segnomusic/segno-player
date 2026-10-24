// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { type PositionElement, type PositionEvent, parsePositions } from './positions.js';
import type { PageSize } from './svg.js';

/** A bar: `[page, x, y, w, h]`, as fractions of the page (0–1). y and h span the whole system. */
export type Bar = [page: number, x: number, y: number, w: number, h: number];

/** A note or rest position: `[page, x, y, h]`, x at the noteheads' centre, y and h the system. */
export type Note = [page: number, x: number, y: number, h: number];

/** `[index, ms]`: the bar (or note) at `index` starts to play at `ms` */
export type TimedEvent = [index: number, ms: number];

/**
 * The sync map, format version 1: everything a player needs to follow the audio on the pages.
 * @decision(DL-003)
 */
export interface SyncMap {
  v: 1;
  /** One per bar, in score order */
  bars: Bar[];
  /** In playback order; indices into `bars` */
  events: TimedEvent[];
  /** One per note/rest position, only when built with an .spos file */
  notes?: Note[];
  /** In playback order; indices into `notes` */
  noteEvents?: TimedEvent[];
}

export interface BuildSyncOptions {
  /** The .spos file, for the note cursor */
  sposXml?: string;
  /** Positions file units per SVG unit */
  unitsPerSvgUnit?: number;
}

/**
 * Positions file units per SVG unit at MuseScore's default PNG resolution: its positions writer scales by
 * `pngDpi / DPI * 12`, and the default `pngDpi` is `DPI`.
 * @decision(DL-002)
 */
export const MPOS_UNITS_PER_SVG_UNIT = 12;

type Box = [page: number, x: number, y: number, w: number, h: number];

const round = (n: number): number => Math.round(n * 1e5) / 1e5;

// The value at fraction `p` of the sorted values (lower of the two around it)
const percentile = (values: number[], p: number): number =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)] ?? 0;

// Elements as [page, x, y, w, h] in fractions of their page, checked to lie on it
// @decision(DL-002)
function toPageFractions(elements: PositionElement[], pages: PageSize[], unitsPerSvgUnit: number, what: string): Box[] {
  return elements.map((e) => {
    const page = pages[e.page];
    if (!page) throw new Error(`${what} ${e.id} is on page ${e.page + 1}, but there are only ${pages.length} pages`);
    const u = unitsPerSvgUnit;
    const box: Box = [e.page, e.x / u / page.w, e.y / u / page.h, e.sx / u / page.w, e.sy / u / page.h];
    // A box off the page means the units don't match the SVGs (another PNG resolution, other pages)
    const [, x, y, w, h] = box;
    if (x < -0.01 || y < -0.01 || x + w > 1.01 || y + h > 1.01) {
      throw new Error(`${what} ${e.id} falls outside its page: the positions don't match these SVG pages`);
    }
    return box;
  });
}

// Events as [element index, ms], checked to be in time order
function toTimedEvents(events: PositionEvent[], elements: PositionElement[], what: string): TimedEvent[] {
  const index = new Map(elements.map((e, i) => [e.id, i]));
  let previous = -Infinity;
  return events.map((e) => {
    const i = index.get(e.elid);
    if (i === undefined) throw new Error(`Event for unknown ${what.toLowerCase()} ${e.elid}`);
    if (e.position < previous) throw new Error('Events are not in time order');
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
export function buildSync(mposXml: string, pages: PageSize[], options: BuildSyncOptions = {}): SyncMap {
  const { sposXml, unitsPerSvgUnit = MPOS_UNITS_PER_SVG_UNIT } = options;
  const mpos = parsePositions(mposXml);
  const sync: SyncMap = {
    v: 1,
    bars: toPageFractions(mpos.elements, pages, unitsPerSvgUnit, 'Bar').map(
      ([page, x, y, w, h]): Bar => [page, round(x), round(y), round(w), round(h)],
    ),
    events: toTimedEvents(mpos.events, mpos.elements, 'Bar'),
  };
  if (sposXml) {
    const spos = parsePositions(sposXml);
    const boxes = toPageFractions(spos.elements, pages, unitsPerSvgUnit, 'Note');
    // @decision(DL-009)
    const notehead = percentile(
      boxes.map((b) => b[3]),
      0.1,
    );
    sync.notes = boxes.map(([page, x, y, , h]): Note => [page, round(x + notehead / 2), round(y), round(h)]);
    sync.noteEvents = toTimedEvents(spos.events, spos.elements, 'Note');
  }
  return sync;
}
