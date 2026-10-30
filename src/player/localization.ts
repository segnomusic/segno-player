// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import type { ScoreMode } from './mode.js';

export type Language = 'en' | 'sv';

// @decision(DL-027)
export interface Messages {
  player: string;
  score: string;
  play: string;
  pause: string;
  restart: string;
  position: string;
  playbackSettings: string;
  scoreLayout: string;
  modes: Record<ScoreMode, string>;
  tempo: string;
  slower: string;
  faster: string;
  followScore: string;
  seekPosition(now: string, total: string): string;
  tempoPercent(percent: number): string;
  tempoQuarters(quarters: number): string;
  pageDescription(page: number, total: number, title?: string): string;
  zoomedScore(title?: string): string;
  barPosition(bar: number, total: number): string;
}

export const messages: Record<Language, Messages> = {
  en: {
    player: 'Player',
    score: 'Score',
    play: 'Play',
    pause: 'Pause',
    restart: 'Back to beginning',
    position: 'Position',
    playbackSettings: 'Playback settings',
    scoreLayout: 'Score layout',
    modes: { auto: 'Auto', full: 'Full score', 'two-system': 'Zoom', reflow: 'Reflow' },
    tempo: 'Tempo',
    slower: 'Slower',
    faster: 'Faster',
    followScore: 'Follow score',
    seekPosition: (now, total) => `${now} of ${total}`,
    tempoPercent: (percent) => `${percent}%`,
    tempoQuarters: (quarters) => `${quarters} quarter notes per minute`,
    pageDescription: (page, total, title) =>
      title ? `${title}, page ${page} of ${total}` : `Page ${page} of ${total}`,
    zoomedScore: (title) => (title ? `${title}, zoomed score` : 'Zoomed score'),
    barPosition: (bar, total) => `Bar ${bar} of ${total}`,
  },
  sv: {
    player: 'Spelare',
    score: 'Notbild',
    play: 'Spela',
    pause: 'Pausa',
    restart: 'Till början',
    position: 'Position',
    playbackSettings: 'Uppspelningsinställningar',
    scoreLayout: 'Notlayout',
    modes: { auto: 'Auto', full: 'Hela bladet', 'two-system': 'Zoom', reflow: 'Anpassad' },
    tempo: 'Tempo',
    slower: 'Långsammare',
    faster: 'Snabbare',
    followScore: 'Följ noterna',
    seekPosition: (now, total) => `${now} av ${total}`,
    tempoPercent: (percent) => `${percent}\u00a0%`,
    tempoQuarters: (quarters) => `${quarters} fjärdedelar per minut`,
    pageDescription: (page, total, title) =>
      title ? `${title}, sida ${page} av ${total}` : `Sida ${page} av ${total}`,
    zoomedScore: (title) => (title ? `${title}, inzoomad notbild` : 'Inzoomad notbild'),
    barPosition: (bar, total) => `Takt ${bar} av ${total}`,
  },
};

// @decision(DL-028)
export function languageOf(element: Element): Language {
  return element.matches(':lang(sv)') ? 'sv' : 'en';
}
