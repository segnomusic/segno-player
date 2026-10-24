// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

/** An element of a positions file: a bar (.mpos) or a segment (.spos), in MuseScore's units. */
export interface PositionElement {
  id: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Zero-based page index */
  page: number;
}

/** An element starting to play: `elid` is an element's id, `position` its start time in ms. */
export interface PositionEvent {
  elid: string;
  position: number;
}

export interface Positions {
  elements: PositionElement[];
  /** In playback order, with repeats and jumps unrolled */
  events: PositionEvent[];
}

// The files are flat, so a tag's attributes are all that is needed: no XML parser.
function attrs(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

/**
 * Parses a MuseScore positions file: `.mpos` (bars) or `.spos` (segments).
 * @decision(DL-002)
 * @throws when the text is not a positions file
 */
export function parsePositions(xml: string): Positions {
  const elements = [...xml.matchAll(/<element\s[^>]*>/g)].map((m): PositionElement => {
    const a = attrs(m[0]);
    return { id: a.id ?? '', x: Number(a.x), y: Number(a.y), sx: Number(a.sx), sy: Number(a.sy), page: Number(a.page) };
  });
  const events = [...xml.matchAll(/<event\s[^>]*>/g)].map((m): PositionEvent => {
    const a = attrs(m[0]);
    return { elid: a.elid ?? '', position: Number(a.position) };
  });
  if (!elements.length || elements.some((e) => [e.x, e.y, e.sx, e.sy, e.page].some(Number.isNaN))) {
    throw new Error('Not a MuseScore positions file');
  }
  return { elements, events };
}
