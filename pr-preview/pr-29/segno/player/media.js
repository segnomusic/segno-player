// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
/** The rates an `<audio>` element plays in every browser: Firefox mutes outside 0.25–4, older Safari caps at 2 */
// @decision(DL-038)
export const AUDIO_RATES = { min: 0.25, max: 2 };
const DEFAULT_TEMPO = { min: 50, max: 150, step: 10 };
function positive(value, fallback) {
    const n = value === null || value.trim() === '' ? Number.NaN : Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
/**
 * The stepper's range from the `tempo-min`, `tempo-max` and `tempo-step` attributes, within what the internal
 * `<audio>` can play when that is in use.
 * @decision(DL-038)
 */
export function tempoRange(attribute, audio) {
    let min = positive(attribute('tempo-min'), DEFAULT_TEMPO.min);
    let max = positive(attribute('tempo-max'), DEFAULT_TEMPO.max);
    if (min > max)
        ({ min, max } = DEFAULT_TEMPO);
    const step = positive(attribute('tempo-step'), DEFAULT_TEMPO.step);
    if (!audio)
        return { min, max, step };
    const playable = (percent) => Math.min(AUDIO_RATES.max * 100, Math.max(AUDIO_RATES.min * 100, percent));
    return { min: playable(min), max: playable(max), step };
}
/** Quarter notes a minute at 100%, from the `tempo-base` attribute; null when it isn't a positive number */
export const tempoBase = (value) => {
    const base = positive(value, Number.NaN);
    return Number.isNaN(base) ? null : base;
};
//# sourceMappingURL=media.js.map