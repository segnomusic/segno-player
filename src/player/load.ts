// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { buildSync, type PageSize, readViewBox, type SyncMap } from '../core/index.js';

/** The player's file inputs, as given in its attributes (URLs relative to the document) */
export interface SyncInputs {
  pages: string[];
  positions: string | null;
  notes: string | null;
  sync: string | null;
}

export interface LoadResult {
  /** null when there is nothing to build a sync map from */
  sync: SyncMap | null;
  /** The pages' sizes, when the SVGs were read */
  pageSizes: PageSize[];
  /** Problems that only cost the note cursor */
  warnings: string[];
}

async function fetchText(url: string, base: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(new URL(url, base), { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

const isIndex = (n: unknown, length: number): boolean =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) < length;
const isNumbers = (entry: unknown, length: number): entry is number[] =>
  Array.isArray(entry) && entry.length === length && entry.every(Number.isFinite);

// Positions as [page, ...fractions] and events as [index, ms] into them, in time order
function checkPositions(positions: unknown, events: unknown, size: number, what: string): void {
  if (!Array.isArray(positions) || !Array.isArray(events)) throw new Error(`A sync map needs ${what} and their events`);
  if (!positions.every((p) => isNumbers(p, size) && isIndex(p[0], Number.POSITIVE_INFINITY))) {
    throw new Error(`The sync map's ${what} must be [page, …] arrays of ${size} numbers`);
  }
  let previous = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    if (!isNumbers(event, 2) || !isIndex(event[0], positions.length) || (event[1] ?? 0) < previous) {
      throw new Error(`The sync map's ${what} events must be [index, ms] pairs in time order`);
    }
    previous = event[1] ?? 0;
  }
}

/**
 * Checks that a value is a sync map this version of Segno can read: its version, and the shape of its entries.
 * @decision(DL-003)
 * @throws when it isn't
 */
export function checkSyncMap(value: unknown): SyncMap {
  const map = value as Partial<SyncMap> | null;
  if (typeof map !== 'object' || map === null) throw new Error('A sync map must be an object');
  if (map.v !== 1) throw new Error(`Unknown sync map version ${String(map.v)}; this version of Segno reads version 1`);
  checkPositions(map.bars, map.events, 5, 'bars');
  if (map.notes !== undefined || map.noteEvents !== undefined) checkPositions(map.notes, map.noteEvents, 4, 'notes');
  return map as SyncMap;
}

/**
 * Loads or builds the sync map from the player's inputs: a prebuilt map's URL, or the positions files and
 * the SVG pages. An .spos file that fails to load or fit only drops the note cursor.
 * @decision(DL-017)
 * @throws when the map can't be loaded or built
 */
export async function loadSync(inputs: SyncInputs, signal: AbortSignal, base = document.baseURI): Promise<LoadResult> {
  if (inputs.sync) {
    const text = await fetchText(inputs.sync, base, signal);
    return { sync: checkSyncMap(JSON.parse(text)), pageSizes: [], warnings: [] };
  }
  if (!inputs.positions) return { sync: null, pageSizes: [], warnings: [] };
  const warnings: string[] = [];
  const [mpos, spos, svgs] = await Promise.all([
    fetchText(inputs.positions, base, signal),
    inputs.notes
      ? fetchText(inputs.notes, base, signal).catch((error: unknown) => {
          if (signal.aborted) throw error;
          warnings.push(`No note cursor: ${String(error)}`);
          return undefined;
        })
      : undefined,
    Promise.all(inputs.pages.map((page) => fetchText(page, base, signal))),
  ]);
  const pageSizes = svgs.map(readViewBox);
  if (spos) {
    try {
      return { sync: buildSync(mpos, pageSizes, { sposXml: spos }), pageSizes, warnings };
    } catch (error) {
      // The bars may still fit: only the notes are dropped if they do
      const sync = buildSync(mpos, pageSizes);
      warnings.push(`No note cursor: ${String(error)}`);
      return { sync, pageSizes, warnings };
    }
  }
  return { sync: buildSync(mpos, pageSizes), pageSizes, warnings };
}
