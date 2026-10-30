// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

/**
 * What `<segno-player>` needs from its audio: a subset of `HTMLMediaElement`, which an `<audio>` element already is.
 * Times are seconds in the score's timeline. It fires the media events the player re-dispatches (`play`, `pause`,
 * `playing`, `waiting`, `seeking`, `seeked`, `timeupdate`, `ratechange`, `durationchange`, `loadedmetadata`,
 * `emptied`, `ended`, `error`) and `canplay`.
 * @decision(DL-037)
 */
export interface SegnoMedia extends EventTarget {
  /** Seconds; setting it seeks */
  currentTime: number;
  /** Seconds; NaN until known */
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  /** 1 is the score's own tempo */
  playbackRate: number;
  defaultPlaybackRate: number;
  readonly error: MediaError | null;
  play(): Promise<void>;
  pause(): void;
}

/** The rates an `<audio>` element plays in every browser: Firefox mutes outside 0.25–4, older Safari caps at 2 */
// @decision(DL-038)
export const AUDIO_RATES = { min: 0.25, max: 2 } as const;

/** The built-in tempo stepper's range and step, in percent */
export interface TempoRange {
  min: number;
  max: number;
  step: number;
}

const DEFAULT_TEMPO: TempoRange = { min: 50, max: 150, step: 10 };

function positive(value: string | null, fallback: number): number {
  const n = value === null || value.trim() === '' ? Number.NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * The stepper's range from the `tempo-min`, `tempo-max` and `tempo-step` attributes, within what the internal
 * `<audio>` can play when that is in use.
 * @decision(DL-038)
 */
export function tempoRange(attribute: (name: string) => string | null, audio: boolean): TempoRange {
  let min = positive(attribute('tempo-min'), DEFAULT_TEMPO.min);
  let max = positive(attribute('tempo-max'), DEFAULT_TEMPO.max);
  if (min > max) ({ min, max } = DEFAULT_TEMPO);
  const step = positive(attribute('tempo-step'), DEFAULT_TEMPO.step);
  if (!audio) return { min, max, step };
  const playable = (percent: number): number =>
    Math.min(AUDIO_RATES.max * 100, Math.max(AUDIO_RATES.min * 100, percent));
  return { min: playable(min), max: playable(max), step };
}

/** Quarter notes a minute at 100%, from the `tempo-base` attribute; null when it isn't a positive number */
export const tempoBase = (value: string | null): number | null => {
  const base = positive(value, Number.NaN);
  return Number.isNaN(base) ? null : base;
};
