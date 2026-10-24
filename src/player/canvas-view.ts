// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/jimutt/segno

import { type PageSize, readViewBox, type SyncMap } from '../core/index.js';
import { CanvasLayout, type CanvasMode, type Crop, type Rect, type ReflowScene, type Tile } from './canvas-layout.js';

export interface CanvasNote {
  page: number;
  x: number;
  y: number;
  h: number;
}

export interface CanvasPoint {
  page: number;
  x: number;
  y: number;
}

interface Raster {
  canvas: HTMLCanvasElement;
  width: number;
  pixels: number;
  used: number;
}

interface PendingRaster {
  width: number;
  promise: Promise<Raster>;
}

type Scene = { mode: 'two-system'; crop: Crop } | { mode: 'reflow'; reflow: ReflowScene };

const MAX_PAGE_PIXELS = 4_000_000;
const MAX_CACHE_PIXELS = 8_000_000;
const MAX_DPR = 3;

const sameStrings = (a: string[], b: string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

// @decision(DL-023)
export class CanvasView {
  readonly root = document.createElement('div');
  readonly overlay = document.createElement('div');
  readonly #canvas = document.createElement('canvas');
  readonly #ctx: CanvasRenderingContext2D | null;
  readonly #onReady: () => void;
  readonly #onError: (error: unknown) => void;

  #pages: string[] = [];
  #bars: SyncMap['bars'] = [];
  #layout: CanvasLayout | null = null;
  #sizes: PageSize[] = [];
  #svgs: string[] = [];
  #mode: CanvasMode = 'two-system';
  #windowStart = 0;
  #bar = -1;
  #width = 0;
  #height = 1;
  #dpr = 1;
  #scene: Scene | null = null;
  #projectionVersion = 0;
  #dirty = true;
  #ready = false;
  #failed = false;
  #loading = false;
  #generation = 0;
  #renderVersion = 0;
  #load: AbortController | null = null;
  #rasters = new Map<number, Raster>();
  #pending = new Map<number, PendingRaster>();
  #clock = 0;

  constructor(onReady: () => void, onError: (error: unknown) => void) {
    this.#onReady = onReady;
    this.#onError = onError;
    this.#ctx = this.#canvas.getContext('2d');
    this.root.className = 'canvas-view';
    this.root.setAttribute('part', 'canvas-view');
    this.root.hidden = true;
    this.#canvas.setAttribute('part', 'canvas-score');
    this.#canvas.setAttribute('role', 'img');
    this.#canvas.setAttribute('aria-label', 'Zoomed score');
    this.overlay.className = 'overlay';
    this.root.append(this.#canvas, this.overlay);
  }

  get ready(): boolean {
    return this.#ready;
  }

  get projectionVersion(): number {
    return this.#projectionVersion;
  }

  get failed(): boolean {
    return this.#failed;
  }

  setLabel(label: string): void {
    this.#canvas.setAttribute('aria-label', label);
  }

  setScore(pages: string[], bars: SyncMap['bars']): void {
    if (sameStrings(pages, this.#pages) && bars === this.#bars && (this.#loading || this.#layout || this.#failed))
      return;
    this.#cancel();
    this.#pages = [...pages];
    this.#bars = bars;
    this.#windowStart = 0;
    this.#failed = false;
    this.#ready = false;
    this.#layout = null;
    this.#scene = null;
    this.#dirty = true;
    if (!pages.length || !bars.length) return;
    if (!this.#ctx) {
      this.#fail(new Error('Canvas 2D is not available'));
      return;
    }
    const generation = this.#generation;
    const load = new AbortController();
    this.#load = load;
    this.#loading = true;
    void Promise.all(
      pages.map(async (page) => {
        const response = await fetch(new URL(page, document.baseURI), { signal: load.signal });
        if (!response.ok) throw new Error(`${page}: HTTP ${response.status}`);
        return response.text();
      }),
    )
      .then((svgs) => {
        if (generation !== this.#generation) return;
        this.#svgs = svgs;
        this.#sizes = svgs.map(readViewBox);
        this.#layout = new CanvasLayout(this.#bars, this.#sizes);
        this.#loading = false;
        this.#load = null;
        this.#dirty = true;
        this.update(this.#bar);
      })
      .catch((error: unknown) => {
        if (generation !== this.#generation) return;
        this.#loading = false;
        this.#load = null;
        this.#fail(error);
      });
  }

  setMode(mode: CanvasMode, bar: number): void {
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.#windowStart = Math.max(0, bar);
    this.#failed = false;
    this.#ready = false;
    this.#scene = null;
    this.#dirty = true;
    this.#renderVersion++;
    this.setScore(this.#pages, this.#bars);
    this.update(bar);
  }

  resize(width: number): void {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    if (Math.abs(width - this.#width) < 0.1 && dpr === this.#dpr) return;
    this.#width = Math.max(0, width);
    this.#dpr = dpr;
    this.#dirty = true;
    this.update(this.#bar);
  }

  cancelLoading(): void {
    if (!this.#loading && !this.#pending.size) return;
    this.#cancel();
    this.#layout = null;
    this.#scene = null;
    this.#ready = false;
    this.#dirty = true;
  }

  update(bar: number): boolean {
    const previous = this.#projectionVersion;
    this.#bar = bar;
    if (this.#layout && bar >= 0 && !this.#layout.contains(this.#mode, this.#windowStart, bar)) {
      this.#windowStart = bar;
      this.#dirty = true;
    }
    if (this.#dirty && this.#layout && this.#width > 0 && !this.#failed) this.#updateScene();
    return this.#projectionVersion !== previous;
  }

  projectBar(bar: number, page: number, box: [number, number, number, number]): Rect | null {
    const [x, y, w, h] = box;
    if (this.#scene?.mode === 'two-system') {
      const crop = this.#scene.crop;
      if (crop.page !== page) return null;
      return {
        x: ((x - crop.x) / crop.w) * this.#width,
        y: ((y - crop.y) / crop.h) * this.#height,
        w: (w / crop.w) * this.#width,
        h: (h / crop.h) * this.#height,
      };
    }
    if (this.#scene?.mode === 'reflow') {
      const tile = this.#scene.reflow.tiles.find((candidate) => candidate.bar === bar && candidate.page === page);
      return tile ? this.#projectTile(tile, x, y, w, h) : null;
    }
    return null;
  }

  projectNote(note: CanvasNote): Rect | null {
    if (this.#scene?.mode === 'two-system') return this.projectBar(-1, note.page, [note.x, note.y, 0, note.h]);
    if (this.#scene?.mode !== 'reflow') return null;
    const tiles = this.#scene.reflow.tiles.filter((tile) => tile.page === note.page);
    const tile =
      tiles.find((candidate) => {
        const bar = this.#bars[candidate.bar];
        return bar && note.x >= bar[1] && note.x <= bar[1] + bar[3] && note.y >= bar[2] && note.y <= bar[2] + bar[4];
      }) ??
      tiles.find((candidate) => {
        const size = this.#sizes[candidate.page];
        if (!size) return false;
        const x = note.x * size.w;
        const y = note.y * size.h;
        return (
          x >= candidate.source.x &&
          x <= candidate.source.x + candidate.source.w &&
          y >= candidate.source.y &&
          y <= candidate.source.y + candidate.source.h
        );
      });
    return tile ? this.#projectTile(tile, note.x, note.y, 0, note.h) : null;
  }

  hitTest(clientX: number, clientY: number): CanvasPoint | null {
    if (!this.#scene) return null;
    const bounds = this.#canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    const x = ((clientX - bounds.left) / bounds.width) * this.#width;
    const y = ((clientY - bounds.top) / bounds.height) * this.#height;
    if (this.#scene.mode === 'two-system') {
      const crop = this.#scene.crop;
      return { page: crop.page, x: crop.x + (x / this.#width) * crop.w, y: crop.y + (y / this.#height) * crop.h };
    }
    const tile = this.#scene.reflow.tiles.find(
      ({ target }) => x >= target.x && x < target.x + target.w && y >= target.y && y < target.y + target.h,
    );
    if (!tile) return null;
    const size = this.#sizes[tile.page];
    if (!size) return null;
    return {
      page: tile.page,
      x: (tile.source.x + (x - tile.target.x) / tile.scale) / size.w,
      y: (tile.source.y + (y - tile.target.y) / tile.scale) / size.h,
    };
  }

  #projectTile(tile: Tile, x: number, y: number, w: number, h: number): Rect | null {
    const size = this.#sizes[tile.page];
    if (!size) return null;
    return {
      x: tile.target.x + (x * size.w - tile.source.x) * tile.scale,
      y: tile.target.y + (y * size.h - tile.source.y) * tile.scale,
      w: w * size.w * tile.scale,
      h: h * size.h * tile.scale,
    };
  }

  #updateScene(): void {
    if (!this.#layout || !this.#ctx) return;
    this.#dirty = false;
    if (this.#mode === 'two-system') {
      const crop = this.#layout.crop(this.#windowStart);
      const size = this.#sizes[crop.page];
      if (!size) return;
      this.#scene = { mode: 'two-system', crop };
      this.#height = (this.#width * crop.h * size.h) / (crop.w * size.w);
    } else {
      const reflow = this.#layout.reflow(this.#windowStart, this.#width);
      this.#scene = { mode: 'reflow', reflow };
      this.#height = reflow.height;
    }
    const width = Math.max(1, Math.round(this.#width * this.#dpr));
    const height = Math.max(1, Math.round(this.#height * this.#dpr));
    if (this.#canvas.width !== width) this.#canvas.width = width;
    if (this.#canvas.height !== height) this.#canvas.height = height;
    this.#canvas.style.height = `${this.#height}px`;
    this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    this.#ctx.fillStyle = '#fff';
    this.#ctx.fillRect(0, 0, this.#width, this.#height);
    this.#projectionVersion++;
    void this.#renderStatic();
  }

  async #renderStatic(): Promise<void> {
    if (!this.#scene || !this.#layout) return;
    const generation = this.#generation;
    const version = ++this.#renderVersion;
    const scene = this.#scene;
    try {
      const required = new Map<number, number>();
      if (scene.mode === 'two-system') {
        required.set(scene.crop.page, (this.#width * this.#dpr) / scene.crop.w);
      } else {
        for (const tile of scene.reflow.tiles) {
          const size = this.#sizes[tile.page];
          if (size) required.set(tile.page, Math.max(required.get(tile.page) ?? 0, tile.scale * this.#dpr * size.w));
        }
      }
      await Promise.all([...required].map(([page, width]) => this.#ensureRaster(page, width)));
      if (generation !== this.#generation || version !== this.#renderVersion || !this.#scene) return;
      this.#draw(scene);
      if (!this.#ready) {
        this.#ready = true;
        this.#onReady();
      }
    } catch (error) {
      if (generation === this.#generation && version === this.#renderVersion) this.#fail(error);
    }
  }

  #draw(scene: Scene): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.#width, this.#height);
    if (scene.mode === 'two-system') {
      const raster = this.#rasters.get(scene.crop.page);
      if (!raster) return;
      const crop = scene.crop;
      ctx.drawImage(
        raster.canvas,
        crop.x * raster.canvas.width,
        crop.y * raster.canvas.height,
        crop.w * raster.canvas.width,
        crop.h * raster.canvas.height,
        0,
        0,
        this.#width,
        this.#height,
      );
    } else {
      for (const tile of scene.reflow.tiles) {
        const raster = this.#rasters.get(tile.page);
        const size = this.#sizes[tile.page];
        if (!raster || !size) continue;
        ctx.drawImage(
          raster.canvas,
          (tile.source.x / size.w) * raster.canvas.width,
          (tile.source.y / size.h) * raster.canvas.height,
          (tile.source.w / size.w) * raster.canvas.width,
          (tile.source.h / size.h) * raster.canvas.height,
          tile.target.x,
          tile.target.y,
          tile.target.w,
          tile.target.h,
        );
      }
    }
  }

  #ensureRaster(page: number, requestedWidth: number): Promise<Raster> {
    const size = this.#sizes[page];
    if (!size || !this.#svgs[page]) return Promise.reject(new Error(`No SVG for page ${page + 1}`));
    const maxWidth = Math.sqrt((MAX_PAGE_PIXELS * size.w) / size.h);
    const width = Math.max(1, Math.ceil(Math.min(requestedWidth, maxWidth)));
    const existing = this.#rasters.get(page);
    if (existing && existing.width >= width * 0.98) {
      existing.used = ++this.#clock;
      return Promise.resolve(existing);
    }
    const pending = this.#pending.get(page);
    if (pending) {
      if (pending.width >= width) return pending.promise;
      return pending.promise.then((raster) =>
        raster.width >= width * 0.98 ? raster : this.#ensureRaster(page, width),
      );
    }
    const generation = this.#generation;
    const promise = this.#rasterize(page, width)
      .then((raster) => {
        if (generation !== this.#generation) {
          raster.canvas.width = raster.canvas.height = 1;
          throw new Error('Stale canvas raster');
        }
        if (this.#pending.get(page)?.promise === promise) {
          const previous = this.#rasters.get(page);
          this.#rasters.set(page, raster);
          if (previous && previous !== raster) previous.canvas.width = previous.canvas.height = 1;
          this.#evictRasters();
        }
        return raster;
      })
      .finally(() => {
        if (this.#pending.get(page)?.promise === promise) this.#pending.delete(page);
      });
    this.#pending.set(page, { width, promise });
    return promise;
  }

  async #rasterize(page: number, requestedWidth: number): Promise<Raster> {
    const size = this.#sizes[page];
    const svg = this.#svgs[page];
    if (!size || !svg) throw new Error(`No SVG for page ${page + 1}`);
    const maxWidth = Math.sqrt((MAX_PAGE_PIXELS * size.w) / size.h);
    const width = Math.max(1, Math.floor(Math.min(requestedWidth, maxWidth)));
    const height = Math.max(1, Math.round((width * size.h) / size.w));
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Could not rasterize page ${page + 1}`));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D is not available');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return { canvas, width, pixels: width * height, used: ++this.#clock };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  #evictRasters(): void {
    const visible = new Set(
      this.#scene?.mode === 'two-system'
        ? [this.#scene.crop.page]
        : (this.#scene?.reflow.tiles.map((tile) => tile.page) ?? []),
    );
    let total = [...this.#rasters.values()].reduce((sum, raster) => sum + raster.pixels, 0);
    const candidates = [...this.#rasters].filter(([page]) => !visible.has(page)).sort((a, b) => a[1].used - b[1].used);
    for (const [page, raster] of candidates) {
      if (total <= MAX_CACHE_PIXELS) break;
      this.#rasters.delete(page);
      raster.canvas.width = raster.canvas.height = 1;
      total -= raster.pixels;
    }
  }

  #fail(error: unknown): void {
    this.#failed = true;
    this.#ready = false;
    this.#renderVersion++;
    this.#onError(error);
  }

  #cancel(): void {
    this.#generation++;
    this.#renderVersion++;
    this.#load?.abort();
    this.#load = null;
    this.#loading = false;
    this.#svgs = [];
    this.#sizes = [];
    this.#pending.clear();
    for (const raster of this.#rasters.values()) raster.canvas.width = raster.canvas.height = 1;
    this.#rasters.clear();
  }
}
