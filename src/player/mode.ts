// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

export const SCORE_MODES = ['full', 'two-system', 'reflow', 'auto'] as const;
export type ScoreMode = (typeof SCORE_MODES)[number];
export type ResolvedScoreMode = Exclude<ScoreMode, 'auto'>;

export interface ModeChangeDetail {
  mode: ScoreMode;
  resolvedMode: ResolvedScoreMode;
}

export const AUTO_TABLET_WIDTH = 768;

// @decision(DL-024)
export function scoreMode(value: string | null): ScoreMode {
  return (SCORE_MODES as readonly string[]).includes(value ?? '') ? (value as ScoreMode) : 'full';
}

export function automaticMode(width: number): ResolvedScoreMode {
  return width > 0 && width < AUTO_TABLET_WIDTH ? 'two-system' : 'full';
}
