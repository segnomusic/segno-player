// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
const PAD_X = 0.018;
const PAD_Y = 0.018;
const TILE_PAD_X = 0.004;
const TILE_PAD_Y = 0.018;
const ROW_PAD_X = 0.018;
const ROW_GAP_CSS = 26;
const SYSTEM_Y_TOLERANCE = 0.002;
const STAFF_HEIGHTS_PER_VIEW = 15;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const median = (values) => {
    if (!values.length)
        return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) / 2)];
};
const hasClass = (tag, name) => tag
    .match(/\sclass="([^"]*)"/)?.[1]
    ?.split(/\s+/)
    .includes(name) ?? false;
const coordinates = (value) => value
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite) ?? [];
// @decision(DL-031)
export function readEngravingGeometry(svg) {
    const lines = [];
    const barLines = [];
    const lyricBottoms = [];
    for (const match of svg.matchAll(/<(?:polyline|path)\b[^>]*>/g)) {
        const tag = match[0];
        if (hasClass(tag, 'StaffLines')) {
            const points = coordinates(tag.match(/\spoints="([^"]*)"/)?.[1]);
            if (points.length >= 2)
                lines.push(points[1]);
        }
        else if (hasClass(tag, 'BarLine')) {
            const points = coordinates(tag.match(/\spoints="([^"]*)"/)?.[1]);
            const ys = points.filter((_, index) => index % 2 === 1);
            if (ys.length >= 2)
                barLines.push({ top: Math.min(...ys), bottom: Math.max(...ys) });
        }
        else if (hasClass(tag, 'Lyrics') || hasClass(tag, 'LyricsLineSegment')) {
            const path = tag.match(/\sd="([^"]*)"/)?.[1];
            const values = path
                ? (path.match(/-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi) ?? []).map(Number)
                : coordinates(tag.match(/\spoints="([^"]*)"/)?.[1]);
            const ys = values.filter((_, index) => index % 2 === 1);
            if (ys.length)
                lyricBottoms.push(Math.max(...ys));
        }
    }
    return { staffLines: lines, barLines, lyricBottoms };
}
// @decision(DL-022) @decision(DL-031)
export class CanvasLayout {
    bars;
    pageSizes;
    groups = [];
    groupOf = [];
    systemOf = [];
    systemBottoms = [];
    chunkOfSystem = [];
    chunks = [];
    cropWidth;
    cropHeight;
    reflowWidth;
    rowMargin;
    constructor(bars, pageSizes, barsPerGroup = 2, engraving = []) {
        if (!bars.length)
            throw new Error('CanvasLayout needs at least one bar');
        if (!pageSizes.length)
            throw new Error('CanvasLayout needs at least one page size');
        if (!Number.isInteger(barsPerGroup) || barsPerGroup < 1) {
            throw new Error('CanvasLayout barsPerGroup must be a positive integer');
        }
        for (const [page, size] of pageSizes.entries()) {
            if (!size || !Number.isFinite(size.w) || !Number.isFinite(size.h) || size.w <= 0 || size.h <= 0) {
                throw new Error(`CanvasLayout page ${page} must have positive, finite dimensions`);
            }
        }
        for (const [index, bar] of bars.entries()) {
            const [page, x, y, w, h] = bar;
            if (!Number.isInteger(page) || page < 0 || page >= pageSizes.length) {
                throw new Error(`CanvasLayout bar ${index} refers to invalid page ${page}`);
            }
            if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
                throw new Error(`CanvasLayout bar ${index} has invalid geometry`);
            }
        }
        this.bars = bars;
        this.pageSizes = pageSizes;
        const systems = this.findSystems();
        this.findGroups(barsPerGroup, systems);
        this.findChunks(systems, engraving);
        const smallestPageWidth = Math.min(...pageSizes.map((page) => page.w));
        const smallestPageHeight = Math.min(...pageSizes.map((page) => page.h));
        const legacyWidth = Math.max(...this.groups.map((group) => {
            const page = this.page(group.page);
            return (group.x1 - group.x0 + 2 * PAD_X) * page.w;
        }));
        const staffHeight = this.findStaffHeight(systems, engraving);
        this.reflowWidth =
            staffHeight === undefined
                ? legacyWidth
                : Math.max(staffHeight * STAFF_HEIGHTS_PER_VIEW, ...this.bars.map((bar) => (bar[3] + 2 * PAD_X) * this.page(bar[0]).w));
        this.cropWidth = Math.min(smallestPageWidth, this.reflowWidth);
        if (staffHeight !== undefined)
            this.findGroups(barsPerGroup, systems, this.reflowWidth);
        this.cropHeight = Math.min(smallestPageHeight, Math.max(...this.chunks.map((chunk) => (chunk.bottom - chunk.top + 2 * PAD_Y) * this.page(chunk.page).h)));
        this.rowMargin = ROW_PAD_X * smallestPageWidth;
    }
    visibleBars(mode, start) {
        const groupIndex = this.groupIndex(start);
        if (mode === 'two-system')
            return [...this.group(groupIndex).bars];
        const second = this.groups[groupIndex + 1];
        return second ? [...this.group(groupIndex).bars, ...second.bars] : [...this.group(groupIndex).bars];
    }
    contains(mode, start, bar) {
        return this.visibleBars(mode, start).includes(bar);
    }
    crop(start) {
        const group = this.group(this.groupIndex(start));
        const page = this.page(group.page);
        const chunkIndex = this.chunkOfSystem[group.system];
        const chunk = chunkIndex === undefined ? undefined : this.chunks[chunkIndex];
        if (!chunk)
            throw new Error(`CanvasLayout has no system pair for bar ${start}`);
        const centreX = ((group.x0 + group.x1) / 2) * page.w;
        const x = clamp(centreX - this.cropWidth / 2, 0, page.w - this.cropWidth);
        const y = clamp(chunk.top * page.h - PAD_Y * page.h, 0, page.h - this.cropHeight);
        return {
            page: group.page,
            bars: [...group.bars],
            x: x / page.w,
            y: y / page.h,
            w: this.cropWidth / page.w,
            h: this.cropHeight / page.h,
        };
    }
    reflow(start, width) {
        if (!Number.isFinite(width) || width <= 0)
            throw new Error('CanvasLayout reflow width must be positive and finite');
        const first = this.groupIndex(start);
        const rowGroups = [this.group(first)];
        const second = this.groups[first + 1];
        if (second)
            rowGroups.push(second);
        const scale = width / (this.reflowWidth + 2 * this.rowMargin);
        const tiles = [];
        let y = 0;
        for (const [rowIndex, group] of rowGroups.entries()) {
            let x = this.rowMargin * scale;
            let rowHeight = 0;
            for (const barIndex of group.bars) {
                const bar = this.bars[barIndex];
                if (!bar)
                    throw new Error(`CanvasLayout has no bar ${barIndex}`);
                const [pageIndex, bx, by, bw, bh] = bar;
                const page = this.page(pageIndex);
                const padX = TILE_PAD_X * page.w;
                const padY = TILE_PAD_Y * page.h;
                const x0 = Math.max(0, bx * page.w - padX);
                const y0 = Math.max(0, by * page.h - padY);
                const x1 = Math.min(page.w, (bx + bw) * page.w + padX);
                const system = this.systemOf[barIndex];
                const contentBottom = system === undefined ? by + bh : (this.systemBottoms[system] ?? by + bh);
                const y1 = Math.min(page.h, contentBottom * page.h + padY);
                const source = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
                const target = { x, y, w: source.w * scale, h: source.h * scale };
                tiles.push({ bar: barIndex, page: pageIndex, source, target, scale });
                x += target.w;
                rowHeight = Math.max(rowHeight, target.h);
            }
            y += rowHeight + (rowIndex + 1 < rowGroups.length ? ROW_GAP_CSS : 0);
        }
        return { width, height: y, tiles };
    }
    page(index) {
        const page = this.pageSizes[index];
        if (!page)
            throw new Error(`CanvasLayout refers to invalid page ${index}`);
        return page;
    }
    group(index) {
        const group = this.groups[index];
        if (!group)
            throw new Error(`CanvasLayout has no bar group ${index}`);
        return group;
    }
    groupIndex(start) {
        if (!Number.isInteger(start) || start < 0 || start >= this.bars.length) {
            throw new Error(`CanvasLayout bar index ${start} is outside 0–${this.bars.length - 1}`);
        }
        const index = this.groupOf[start];
        if (index === undefined)
            throw new Error(`CanvasLayout has no bar group for bar ${start}`);
        return index;
    }
    findSystems() {
        const systems = [];
        for (const [index, bar] of this.bars.entries()) {
            const [page, , y, , h] = bar;
            const last = systems[systems.length - 1];
            const first = last ? this.bars[last.first] : undefined;
            if (last && first && last.page === page && Math.abs(first[2] - y) < SYSTEM_Y_TOLERANCE) {
                last.top = Math.min(last.top, y);
                last.bottom = Math.max(last.bottom, y + h);
            }
            else {
                systems.push({ page, first: index, top: y, bottom: y + h });
            }
            this.systemOf[index] = systems.length - 1;
        }
        return systems;
    }
    findStaffHeight(systems, engraving) {
        const heights = systems.flatMap((system) => {
            const page = this.page(system.page);
            const tolerance = SYSTEM_Y_TOLERANCE * page.h;
            const top = system.top * page.h;
            const bottom = system.bottom * page.h;
            const lines = (engraving[system.page]?.staffLines ?? [])
                .filter((y) => y >= top - tolerance && y <= bottom + tolerance)
                .sort((a, b) => a - b);
            const spacing = median(lines
                .slice(1)
                .map((y, index) => y - lines[index])
                .filter((gap) => gap > 0));
            const height = spacing === undefined ? undefined : spacing * 4;
            const supported = height !== undefined &&
                (engraving[system.page]?.barLines ?? []).some((line) => {
                    const lineHeight = line.bottom - line.top;
                    return (line.top >= top - tolerance &&
                        line.bottom <= bottom + tolerance &&
                        lineHeight >= height * 0.9 &&
                        lineHeight <= height * 1.1);
                });
            return supported && height <= bottom - top + 2 * tolerance ? [height] : [];
        });
        return median(heights);
    }
    findGroups(barsPerGroup, systems, widthLimit = Infinity) {
        this.groups.length = this.groupOf.length = 0;
        for (let start = 0; start < this.bars.length;) {
            const system = this.systemOf[start];
            if (system === undefined || !systems[system])
                throw new Error(`CanvasLayout has no system for bar ${start}`);
            const first = this.bars[start];
            if (!first)
                throw new Error(`CanvasLayout has no bar ${start}`);
            const indices = [start];
            const x0 = first[1];
            let x1 = first[1] + first[3];
            this.groupOf[start] = this.groups.length;
            let next = start + 1;
            while (next < this.bars.length && indices.length < barsPerGroup && this.systemOf[next] === system) {
                const bar = this.bars[next];
                if (!bar)
                    throw new Error(`CanvasLayout has no bar ${next}`);
                const candidateX1 = Math.max(x1, bar[1] + bar[3]);
                if ((candidateX1 - x0 + 2 * PAD_X) * this.page(bar[0]).w > widthLimit)
                    break;
                indices.push(next);
                this.groupOf[next] = this.groups.length;
                x1 = candidateX1;
                next += 1;
            }
            this.groups.push({ bars: indices, page: first[0], system, x0, x1 });
            start = next;
        }
    }
    findChunks(systems, engraving) {
        for (const [index, system] of systems.entries()) {
            const page = this.page(system.page);
            const next = systems[index + 1];
            const nextTop = next?.page === system.page ? next.top : Infinity;
            const lyricBottom = Math.max(0, ...(engraving[system.page]?.lyricBottoms ?? [])
                .filter((bottom) => bottom >= system.top * page.h && bottom < nextTop * page.h)
                .map((bottom) => bottom / page.h));
            this.systemBottoms[index] = Math.max(system.bottom, lyricBottom);
        }
        for (let index = 0; index < systems.length;) {
            const first = systems[index];
            if (!first)
                throw new Error(`CanvasLayout has no system ${index}`);
            const second = systems[index + 1];
            const paired = second?.page === first.page;
            const chunkIndex = this.chunks.length;
            this.chunks.push({
                page: first.page,
                top: paired ? Math.min(first.top, second.top) : first.top,
                bottom: paired
                    ? Math.max(this.systemBottoms[index] ?? first.bottom, this.systemBottoms[index + 1] ?? second.bottom)
                    : (this.systemBottoms[index] ?? first.bottom),
            });
            this.chunkOfSystem[index] = chunkIndex;
            if (paired)
                this.chunkOfSystem[index + 1] = chunkIndex;
            index += paired ? 2 : 1;
        }
    }
}
//# sourceMappingURL=canvas-layout.js.map