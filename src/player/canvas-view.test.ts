// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/jimutt/segno

import { afterEach, describe, expect, test, vi } from 'vitest';
import type { SyncMap } from '../core/index.js';
import { CanvasView } from './canvas-view.js';
import { blankPage, revokeAll } from './test-assets.js';

const bars: SyncMap['bars'] = [
  [0, 0.05, 0.1, 0.2, 0.1],
  [0, 0.3, 0.1, 0.2, 0.1],
  [0, 0.05, 0.3, 0.2, 0.1],
  [0, 0.3, 0.3, 0.2, 0.1],
];

function makeView(): { view: CanvasView; errors: unknown[] } {
  const errors: unknown[] = [];
  const view = new CanvasView(
    () => {},
    (error) => errors.push(error),
  );
  view.root.style.width = '400px';
  view.root.hidden = false;
  document.body.append(view.root);
  return { view, errors };
}

afterEach(() => {
  document.body.replaceChildren();
  revokeAll();
  vi.restoreAllMocks();
});

describe('CanvasView', () => {
  test('projects markers and notes and inverse-maps clicks in both canvas layouts', async () => {
    const { view, errors } = makeView();
    view.setLabel('Example, zoomed score');
    view.resize(400);
    view.resize(400);
    view.setScore([blankPage()], bars);
    await vi.waitFor(() => expect(view.ready).toBe(true));
    expect(errors).toEqual([]);
    expect(view.root.querySelector('canvas')?.getAttribute('aria-label')).toBe('Example, zoomed score');
    expect(view.failed).toBe(false);
    view.update(0);

    const box = bars[0]?.slice(1) as [number, number, number, number];
    const projected = view.projectBar(0, 0, box);
    expect(projected).not.toBeNull();
    expect(view.projectBar(0, 1, box)).toBeNull();
    expect(view.projectNote({ page: 0, x: 0.1, y: 0.1, h: 0.1 })).not.toBeNull();
    view.update(-1);
    expect(view.projectNote({ page: 0, x: 0.1, y: 0.1, h: 0.1 })).not.toBeNull();
    view.update(0);

    const canvas = view.root.querySelector('canvas');
    if (!canvas || !projected) throw new Error('No canvas or projection');
    const bounds = canvas.getBoundingClientRect();
    const cropPoint = view.hitTest(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    expect(cropPoint?.page).toBe(0);

    view.setMode('reflow', 0);
    await vi.waitFor(() => expect(view.ready).toBe(true));
    view.update(1);
    const oldNote = { page: 0, x: box[0] + box[2] / 2, y: box[1], h: box[3] };
    expect(view.projectNote(oldNote)).toEqual(view.projectBar(0, 0, [oldNote.x, oldNote.y, 0, oldNote.h]));
    expect(view.projectNote({ ...oldNote, x: box[0] - 0.002 })).not.toBeNull();
    expect(view.projectNote({ ...oldNote, x: 0.99, y: 0.99 })).toBeNull();
    expect(view.projectNote({ ...oldNote, page: 1 })).toBeNull();
    view.update(0);
    const tile = view.projectBar(0, 0, box);
    expect(tile).not.toBeNull();
    expect(view.projectBar(99, 0, box)).toBeNull();
    if (!tile) throw new Error('No reflow projection');
    const point = view.hitTest(bounds.left + tile.x + tile.w / 2, bounds.top + tile.y + tile.h / 2);
    expect(point?.page).toBe(0);
    expect(point?.x).toBeCloseTo(box[0] + box[2] / 2);
    expect(point?.y).toBeCloseTo(box[1] + box[3] / 2);
    expect(view.hitTest(bounds.left, bounds.top)).toBeNull();
    view.root.remove();
    expect(view.hitTest(0, 0)).toBeNull();
  });

  test('cancels an interrupted source load and can retry the same score', async () => {
    const { view, errors } = makeView();
    view.resize(400);
    const pages = [blankPage()];
    view.setScore(pages, bars);
    view.cancelLoading();
    expect(view.ready).toBe(false);
    view.setScore(pages, bars);
    await vi.waitFor(() => expect(view.ready).toBe(true));
    expect(errors).toEqual([]);
    view.setScore([], bars);
    view.setScore([blankPage()], []);
    view.setScore([], []);
    expect(view.ready).toBe(false);
    expect(view.projectBar(0, 0, [0.1, 0.1, 0.2, 0.1])).toBeNull();
  });

  test('reports asset failures without a scene', async () => {
    const { view, errors } = makeView();
    view.resize(400);
    view.setScore(['/missing-direct-canvas-page.svg'], bars);
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(view.failed).toBe(true);
    expect(view.ready).toBe(false);
    expect(view.projectBar(0, 0, [0.1, 0.1, 0.2, 0.1])).toBeNull();
    expect(view.hitTest(0, 0)).toBeNull();
    view.cancelLoading();
  });
});
