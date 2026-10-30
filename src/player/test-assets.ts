// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

// Synthetic pages and audio for the player's browser tests: the fixture's positions need only a page of the
// right size and audio of the right length, not the real score.

/** The fixture's positions files, served by the test server */
export const fixture = {
  mpos: '/fixtures/nar-juldagsmorgon-glimmar.mpos',
  spos: '/fixtures/nar-juldagsmorgon-glimmar.spos',
  /** When the last bar starts */
  lastEventMs: 23478,
};

const urls: string[] = [];
const blobUrl = (blob: Blob): string => {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
};

/** A blank A4 page with the size MuseScore 4.7 gives its SVG pages */
export function blankPage(w = 9921.26, h = 14031.5): string {
  const svg = `<?xml version="1.0"?>\n<svg width="210mm" height="297mm" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#fff"/></svg>`;
  return blobUrl(new Blob([svg], { type: 'image/svg+xml' }));
}

/** A silent mono WAV file of the given length */
export function silentAudio(seconds: number, sampleRate = 8000): string {
  const samples = Math.round(seconds * sampleRate);
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const text = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return blobUrl(new Blob([view.buffer], { type: 'audio/wav' }));
}

/** A JSON file's URL */
export function jsonFile(value: unknown): string {
  return blobUrl(new Blob([JSON.stringify(value)], { type: 'application/json' }));
}

export function revokeAll(): void {
  for (const url of urls.splice(0)) URL.revokeObjectURL(url);
}

/** Resolves with the next event of a type on a target */
export const next = (target: EventTarget, type: string): Promise<Event> =>
  new Promise((resolve) => target.addEventListener(type, resolve, { once: true }));

/** A host's media for the tests: a clock that moves only when told to, and a count of `play()` calls */
export class FakeMedia extends EventTarget {
  #time = 0;
  #rate = 1;
  duration: number;
  paused = true;
  ended = false;
  defaultPlaybackRate = 1;
  error: MediaError | null = null;
  plays = 0;

  constructor(duration = 30) {
    super();
    this.duration = duration;
  }
  get currentTime(): number {
    return this.#time;
  }
  set currentTime(seconds: number) {
    this.#time = seconds;
    this.fire('seeking');
    this.fire('seeked');
  }
  get playbackRate(): number {
    return this.#rate;
  }
  set playbackRate(rate: number) {
    this.#rate = rate;
    this.fire('ratechange');
  }
  /** Moves the clock as playback does: without seeking or any event */
  tick(seconds: number): void {
    this.#time = seconds;
  }
  play(): Promise<void> {
    this.plays++;
    if (this.paused) {
      this.paused = false;
      this.fire('play');
      this.fire('playing');
    }
    return Promise.resolve();
  }
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.fire('pause');
  }
  fire(type: string): void {
    this.dispatchEvent(new Event(type));
  }
}
