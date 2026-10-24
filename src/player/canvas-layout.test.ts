// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { describe, expect, test } from 'vitest';
import type { PageSize, SyncMap } from '../core/index.js';
import { CanvasLayout, type Rect } from './canvas-layout.js';

type Bars = SyncMap['bars'];

const bar = (page: number, x: number, y: number, w: number, h = 0.1): Bars[number] => [page, x, y, w, h];
const A4: PageSize = { w: 1000, h: 2000 };

function expectRect(actual: Rect | undefined, expected: Rect): void {
  if (!actual) throw new Error('Expected a rectangle');
  for (const key of ['x', 'y', 'w', 'h'] as const) expect(actual[key]).toBeCloseTo(expected[key]);
}

describe('CanvasLayout grouping and visibility', () => {
  const bars: Bars = [
    bar(0, 0.05, 0.1, 0.2),
    bar(0, 0.25, 0.1, 0.2),
    bar(0, 0.45, 0.1, 0.2),
    bar(0, 0.65, 0.1, 0.2),
    bar(0, 0.05, 0.3, 0.2),
    bar(0, 0.25, 0.3, 0.2),
  ];

  test('groups up to N contiguous bars without crossing systems', () => {
    const layout = new CanvasLayout(bars, [A4]);
    expect(layout.visibleBars('two-system', 0)).toEqual([0, 1]);
    expect(layout.visibleBars('two-system', 1)).toEqual([0, 1]);
    expect(layout.visibleBars('two-system', 2)).toEqual([2, 3]);
    expect(layout.visibleBars('two-system', 4)).toEqual([4, 5]);

    const threes = new CanvasLayout(bars, [A4], 3);
    expect(threes.visibleBars('two-system', 1)).toEqual([0, 1, 2]);
    expect(threes.visibleBars('two-system', 3)).toEqual([3]);
    expect(threes.visibleBars('two-system', 4)).toEqual([4, 5]);
  });

  test('uses page and y tolerance as system boundaries', () => {
    const pages = [A4, A4];
    const tolerant = new CanvasLayout(
      [bar(0, 0.1, 0.1, 0.2), bar(0, 0.3, 0.1019, 0.2), bar(0, 0.5, 0.104, 0.2)],
      pages,
      3,
    );
    expect(tolerant.visibleBars('two-system', 0)).toEqual([0, 1]);
    expect(tolerant.visibleBars('two-system', 2)).toEqual([2]);

    const newPage = new CanvasLayout([bar(0, 0.1, 0.1, 0.2), bar(1, 0.1, 0.1, 0.2)], pages, 3);
    expect(newPage.visibleBars('two-system', 0)).toEqual([0]);
    expect(newPage.visibleBars('two-system', 1)).toEqual([1]);
  });

  test('prepares the next consecutive group as the second reflow row', () => {
    const layout = new CanvasLayout(bars, [A4]);
    expect(layout.visibleBars('reflow', 0)).toEqual([0, 1, 2, 3]);
    expect(layout.visibleBars('reflow', 1)).toEqual([0, 1, 2, 3]);
    expect(layout.visibleBars('reflow', 2)).toEqual([2, 3, 4, 5]);
    expect(layout.visibleBars('reflow', 4)).toEqual([4, 5]);
    expect(layout.reflow(0, 800).tiles.map((tile) => tile.bar)).toEqual([0, 1, 2, 3]);
  });

  test('contains follows the held window rather than regrouping around the tested bar', () => {
    const layout = new CanvasLayout(bars, [A4]);
    expect(layout.contains('two-system', 0, 1)).toBe(true);
    expect(layout.contains('two-system', 0, 2)).toBe(false);
    expect(layout.contains('reflow', 0, 3)).toBe(true);
    expect(layout.contains('reflow', 0, 4)).toBe(false);
    expect(layout.contains('reflow', 0, -1)).toBe(false);
  });
});

describe('CanvasLayout two-system crops', () => {
  test('pins every group in a fixed system pair to the same vertical crop', () => {
    const layout = new CanvasLayout(
      [
        bar(0, 0.1, 0.1, 0.2, 0.1),
        bar(0, 0.3, 0.1, 0.2, 0.1),
        bar(0, 0.1, 0.3, 0.2, 0.12),
        bar(0, 0.3, 0.3, 0.2, 0.12),
      ],
      [{ w: 1000, h: 1000 }],
    );
    const first = layout.crop(0);
    const second = layout.crop(2);
    expect(first.bars).toEqual([0, 1]);
    expect(second.bars).toEqual([2, 3]);
    expect(first.y).toBeCloseTo(0.082);
    expect(second.y).toBeCloseTo(first.y);
    expect(first.h).toBeCloseTo(0.356);
    expect(second.h).toBeCloseTo(first.h);
  });

  test('handles a lone final system and never pairs systems across pages', () => {
    const layout = new CanvasLayout(
      [bar(0, 0.1, 0.6, 0.3, 0.1), bar(1, 0.1, 0.05, 0.3, 0.1), bar(1, 0.1, 0.25, 0.3, 0.1)],
      [A4, A4],
      1,
    );
    expect(layout.crop(0).y).toBeCloseTo(0.582);
    expect(layout.crop(1).y).toBeCloseTo(0.032);
    expect(layout.crop(2).y).toBeCloseTo(0.032);
  });

  test('centres on the containing group and clamps at page edges', () => {
    const page = { w: 1000, h: 1000 };
    const centred = new CanvasLayout([bar(0, 0.1, 0.1, 0.2), bar(0, 0.3, 0.1, 0.2), bar(0, 0.6, 0.1, 0.2)], [page]);
    expect(centred.crop(0).w).toBeCloseTo(0.436);
    expect(centred.crop(2).x).toBeCloseTo(0.482);

    const left = new CanvasLayout([bar(0, 0, 0, 0.1)], [page], 1);
    expect(left.crop(0)).toMatchObject({ x: 0, y: 0 });
    const right = new CanvasLayout([bar(0, 0.9, 0.9, 0.1)], [page], 1);
    expect(right.crop(0).x + right.crop(0).w).toBeCloseTo(1);
    expect(right.crop(0).y + right.crop(0).h).toBeCloseTo(1);
  });

  test('locks dimensions in SVG units while converting them to each page’s fractions', () => {
    const pages: [PageSize, PageSize] = [
      { w: 1000, h: 1000 },
      { w: 500, h: 800 },
    ];
    const layout = new CanvasLayout(
      [bar(0, 0.4, 0.1, 0.2, 0.2), bar(0, 0.6, 0.1, 0.2, 0.2), bar(1, 0.4, 0.1, 0.2, 0.2), bar(1, 0.6, 0.1, 0.2, 0.2)],
      pages,
    );
    const first = layout.crop(0);
    const second = layout.crop(2);
    expect(first.w * pages[0].w).toBeCloseTo(436);
    expect(second.w * pages[1].w).toBeCloseTo(436);
    expect(first.h * pages[0].h).toBeCloseTo(236);
    expect(second.h * pages[1].h).toBeCloseTo(236);
    expect(second.w).toBeCloseTo(0.872);
    expect(second.h).toBeCloseTo(0.295);
    expect(first.x * pages[0].w).toBeCloseTo(382);
    expect(second.x * pages[1].w).toBeCloseTo(64);
  });

  test('caps the global viewport to fit every page aspect ratio', () => {
    const pages: [PageSize, PageSize] = [
      { w: 1000, h: 1000 },
      { w: 600, h: 400 },
    ];
    const layout = new CanvasLayout([bar(0, 0.1, 0.1, 0.8, 0.8), bar(1, 0.1, 0.1, 0.2, 0.2)], pages, 1);
    const first = layout.crop(0);
    const second = layout.crop(1);
    expect(first.w * pages[0].w).toBeCloseTo(600);
    expect(second.w).toBe(1);
    expect(first.h * pages[0].h).toBeCloseTo(400);
    expect(second.h).toBe(1);
    expect(second).toMatchObject({ x: 0, y: 0 });
  });
});

describe('CanvasLayout reflow geometry', () => {
  test('tiles padded SVG sources left-aligned at one isotropic scale', () => {
    const layout = new CanvasLayout(
      [bar(0, 0.1, 0.1, 0.2, 0.1), bar(0, 0.3, 0.1, 0.2, 0.1), bar(0, 0.1, 0.4, 0.2, 0.1)],
      [A4],
    );
    const scene = layout.reflow(0, 944);
    expect(scene.width).toBe(944);
    expect(scene.tiles).toHaveLength(3);
    expect(scene.tiles.every((tile) => tile.scale === 2)).toBe(true);
    expect(scene.tiles[0]).toMatchObject({ bar: 0, page: 0, scale: 2 });
    expectRect(scene.tiles[0]?.source, { x: 96, y: 164, w: 208, h: 272 });
    expectRect(scene.tiles[0]?.target, { x: 36, y: 0, w: 416, h: 544 });
    expect(scene.tiles[1]?.target.x).toBeCloseTo(452);
    expect(scene.tiles[1]?.target.y).toBe(0);
    expect(scene.tiles[2]?.target.x).toBe(36);
    expect(scene.tiles[2]?.target.y).toBe(570);
    expect(scene.height).toBe(1114);
  });

  test('omits the row gap after a last lone row', () => {
    const layout = new CanvasLayout(
      [bar(0, 0.1, 0.1, 0.2, 0.1), bar(0, 0.3, 0.1, 0.2, 0.1), bar(0, 0.1, 0.4, 0.2, 0.1)],
      [A4],
    );
    const scene = layout.reflow(2, 944);
    expect(scene.tiles.map((tile) => tile.bar)).toEqual([2]);
    expect(scene.tiles[0]?.target.y).toBe(0);
    expect(scene.height).toBe(544);
  });

  test('clamps tile padding to source page boundaries', () => {
    const page = { w: 1000, h: 1000 };
    const layout = new CanvasLayout([bar(0, 0, 0, 0.05, 0.05), bar(0, 0.95, 0.9, 0.05, 0.1)], [page], 1);
    const scene = layout.reflow(0, 500);
    expectRect(scene.tiles[0]?.source, { x: 0, y: 0, w: 54, h: 68 });
    expectRect(scene.tiles[1]?.source, { x: 946, y: 882, w: 54, h: 118 });
    for (const tile of scene.tiles) {
      expect(tile.source.x).toBeGreaterThanOrEqual(0);
      expect(tile.source.y).toBeGreaterThanOrEqual(0);
      expect(tile.source.x + tile.source.w).toBeLessThanOrEqual(page.w);
      expect(tile.source.y + tile.source.h).toBeLessThanOrEqual(page.h);
    }
  });

  test('keeps one scale and CSS-pixel row gap across varying page sizes', () => {
    const pages = [A4, { w: 500, h: 1000 }];
    const layout = new CanvasLayout(
      [bar(0, 0.1, 0.1, 0.2, 0.1), bar(0, 0.3, 0.1, 0.2, 0.1), bar(1, 0.1, 0.1, 0.2, 0.1)],
      pages,
    );
    const scene = layout.reflow(0, 908);
    expect(scene.tiles.map((tile) => tile.scale)).toEqual([2, 2, 2]);
    expect(scene.tiles[0]?.target.x).toBe(18);
    expectRect(scene.tiles[2]?.source, { x: 48, y: 82, w: 104, h: 136 });
    expect(scene.tiles[2]?.target.y).toBe(570);
    expect(scene.height).toBe(842);
  });
});

describe('CanvasLayout invalid inputs', () => {
  test('rejects missing bars and page sizes', () => {
    expect(() => new CanvasLayout([], [A4])).toThrow(/at least one bar/);
    expect(() => new CanvasLayout([bar(0, 0, 0, 0.1)], [])).toThrow(/at least one page size/);
  });

  test('rejects invalid page references and dimensions', () => {
    for (const page of [-1, 1, 0.5]) {
      expect(() => new CanvasLayout([bar(page, 0, 0, 0.1)], [A4])).toThrow(/invalid page/);
    }
    expect(() => new CanvasLayout([bar(0, 0, 0, 0.1)], [{ w: 0, h: 100 }])).toThrow(/positive, finite/);
    expect(() => new CanvasLayout([bar(0, 0, 0, 0)], [A4])).toThrow(/invalid geometry/);
    expect(() => new CanvasLayout([bar(0, 0, 0, 0.1, 0)], [A4])).toThrow(/invalid geometry/);
  });

  test('rejects invalid group sizes, bar indices, and output widths', () => {
    const bars: Bars = [bar(0, 0, 0, 0.1)];
    expect(() => new CanvasLayout(bars, [A4], 0)).toThrow(/positive integer/);
    expect(() => new CanvasLayout(bars, [A4], 1.5)).toThrow(/positive integer/);
    const layout = new CanvasLayout(bars, [A4]);
    expect(() => layout.crop(-1)).toThrow(/outside 0–0/);
    expect(() => layout.visibleBars('reflow', 1)).toThrow(/outside 0–0/);
    expect(() => layout.reflow(0, 0)).toThrow(/positive and finite/);
    expect(() => layout.reflow(0, Number.NaN)).toThrow(/positive and finite/);
  });
});
