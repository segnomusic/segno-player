// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/jimutt/segno
/**
 * The size of an SVG page, from the `viewBox` of its root `<svg>` tag.
 * @decision(DL-002)
 * @throws when the SVG has no valid viewBox
 */
export function readViewBox(svg) {
    const root = svg.match(/<svg\s[^>]*>/)?.[0];
    const viewBox = root
        ?.match(/\sviewBox="([^"]*)"/)?.[1]
        ?.trim()
        .split(/[\s,]+/)
        .map(Number);
    const [, , w, h] = viewBox ?? [];
    if (viewBox?.length !== 4 || viewBox.some(Number.isNaN) || w === undefined || h === undefined) {
        throw new Error('SVG without a viewBox');
    }
    return { w, h };
}
//# sourceMappingURL=svg.js.map