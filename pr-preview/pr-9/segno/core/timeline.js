// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/jimutt/segno
// The index of the last time at or before `ms` in sorted `times` (-1 before the first)
function lastAtOrBefore(times, ms) {
    let lo = 0;
    let hi = times.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if ((times[mid] ?? Infinity) <= ms) {
            found = mid;
            lo = mid + 1;
        }
        else
            hi = mid - 1;
    }
    return found;
}
// How far `ms` is from `start` to `end`, 0–1
const fraction = (ms, start, end) => end > start ? Math.min(1, Math.max(0, (ms - start) / (end - start))) : 0;
// Notes and bars on the same line of music share the page and (nearly) the top
const sameSystem = (a, b) => a[0] === b[0] && Math.abs(a[2] - b[2]) < 0.002;
/** Lookups over a sync map for a player, each in O(log n) or better except `barAtPoint` and `seekTimeForBar`. */
export function createTimeline(sync) {
    const { bars, events, notes = [], noteEvents = [] } = sync;
    const times = events.map((e) => e[1]);
    const noteTimes = noteEvents.map((e) => e[1]);
    // Where the bar holding each note ends: the note cursor runs on to it after the last note of a line,
    // or before a repeat sends playback back
    const barEnd = notes.map((n) => {
        const bar = bars.find((b) => sameSystem(b, n) && n[1] >= b[1] && n[1] < b[1] + b[3]);
        return bar ? bar[1] + bar[3] : n[1];
    });
    const eventIndexAt = (ms) => lastAtOrBefore(times, ms);
    // @decision(DL-009)
    function noteAt(ms, endMs) {
        const i = Math.max(0, lastAtOrBefore(noteTimes, ms));
        const current = noteEvents[i];
        const note = current && notes[current[0]];
        if (!current || !note)
            return null;
        const [page, x, y, h] = note;
        const next = noteEvents[i + 1];
        const nextNote = next && notes[next[0]];
        const target = nextNote && sameSystem(nextNote, note) && nextNote[1] > x ? nextNote[1] : (barEnd[current[0]] ?? x);
        const start = current[1];
        const end = next ? next[1] : Math.max(endMs ?? start, start);
        return { page, x: x + (target - x) * fraction(ms, start, end), y, h };
    }
    function at(ms, endMs) {
        const i = eventIndexAt(Math.max(ms, times[0] ?? 0));
        const event = events[i];
        const bar = event && bars[event[0]];
        if (!event || !bar)
            return null;
        const start = event[1];
        const next = events[i + 1];
        const end = next ? next[1] : Math.max(endMs ?? start, start);
        const [page, x, y, w, h] = bar;
        return {
            event: i,
            bar: event[0],
            page,
            box: [x, y, w, h],
            progress: fraction(ms, start, end),
            note: noteAt(ms, endMs),
        };
    }
    function barAtPoint(page, fx, fy) {
        return bars.findIndex(([p, x, y, w, h]) => p === page && fx >= x && fx < x + w && fy >= y && fy < y + h);
    }
    // @decision(DL-009)
    function seekTimeForBar(bar, nowMs = 0) {
        let best = -1;
        for (const [b, t] of events) {
            if (b === bar && (best < 0 || Math.abs(t - nowMs) < Math.abs(best - nowMs)))
                best = t;
        }
        return best;
    }
    return { eventIndexAt, at, noteAt, barAtPoint, seekTimeForBar, bars, events };
}
//# sourceMappingURL=timeline.js.map