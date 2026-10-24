// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
export const SCORE_MODES = ['full', 'two-system', 'reflow', 'auto'];
export const AUTO_TABLET_WIDTH = 768;
// @decision(DL-024)
export function scoreMode(value) {
    return SCORE_MODES.includes(value ?? '') ? value : 'full';
}
export function automaticMode(width) {
    return width > 0 && width < AUTO_TABLET_WIDTH ? 'two-system' : 'full';
}
//# sourceMappingURL=mode.js.map