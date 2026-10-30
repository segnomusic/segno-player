// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

// The player's shadow styles. Every themable value is a --segno-* custom property read with its default as the
// var() fallback, never set on :host, so values from the page inherit and win.
// @decision(DL-015) @decision(DL-006) @decision(DL-024)
export const css = /* css */ `
:host {
  display: block;
  position: relative;
  container: segno-player / inline-size;
  font: var(--segno-font, inherit);
}
:host([hidden]),
[hidden] {
  display: none !important;
}

.pages {
  display: flex;
  flex-direction: column;
  gap: var(--segno-page-gap, 1rem);
  border-radius: 2px;
}
.pages:focus-visible {
  outline: 2px solid var(--segno-accent, #b3261e);
  outline-offset: 4px;
}
.page {
  position: relative;
  background: var(--segno-page-background, #fff);
  box-shadow: var(--segno-page-shadow, 0 1px 2px rgb(0 0 0 / 0.12), 0 4px 16px rgb(0 0 0 / 0.08));
}
.page img {
  display: block;
  width: 100%;
  height: auto;
}
.canvas-view {
  position: relative;
  background: var(--segno-page-background, #fff);
  box-shadow: var(--segno-page-shadow, 0 1px 2px rgb(0 0 0 / 0.12), 0 4px 16px rgb(0 0 0 / 0.08));
}
.canvas-view canvas {
  display: block;
  width: 100%;
}
@media print {
  .canvas-view {
    display: none !important;
  }
  .pages .page {
    display: block !important;
  }
}
.overlay {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.pages[data-markers] .overlay {
  cursor: pointer;
}

.bar-marker {
  position: absolute;
  pointer-events: none;
  mix-blend-mode: multiply;
  background: color-mix(in srgb, var(--segno-accent, #b3261e) var(--segno-bar-strength, 7%), transparent);
  mask-image: linear-gradient(to right, transparent, #000 var(--fade), #000 calc(100% - var(--fade)), transparent);
  opacity: 0;
  transition: opacity var(--segno-bar-fade-out, 260ms) ease-out;
  scroll-margin-top: 25vh;
}
.bar-marker.on {
  opacity: 1;
  transition-duration: var(--segno-bar-fade-in, 90ms);
  @starting-style {
    opacity: 0;
  }
}
:host([bar-change="jump"]) .bar-marker {
  transition: none;
}
.note-cursor {
  position: absolute;
  width: var(--segno-cursor-width, 2px);
  translate: -50% 0;
  pointer-events: none;
  mix-blend-mode: multiply;
  background: color-mix(in srgb, var(--segno-accent, #b3261e) var(--segno-cursor-strength, 55%), transparent);
}
@container style(--segno-markers: strong) {
  .bar-marker {
    background: color-mix(
      in srgb,
      var(--segno-accent, #b3261e) calc(2 * var(--segno-bar-strength, 7%)),
      transparent
    );
  }
  .note-cursor {
    background: color-mix(
      in srgb,
      var(--segno-accent, #b3261e) min(100%, calc(1.6 * var(--segno-cursor-strength, 55%))),
      transparent
    );
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar-marker {
    transition: none;
  }
}

.controls-area {
  position: sticky;
  bottom: 0.75rem;
  z-index: 1;
}
:host(:not([controls])) .controls {
  display: none;
}
.controls {
  display: flex;
  align-items: center;
  margin-top: 0.75rem;
  gap: var(--segno-controls-gap, 1.125rem);
  padding: 0.75rem 1.125rem;
  border-radius: var(--segno-controls-radius, 1.125rem);
  background: var(--segno-controls-background, #1d1c1a);
  color: var(--segno-controls-color, #fff);
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
  accent-color: var(--segno-controls-accent, var(--segno-accent, #b3261e));
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
.controls button {
  flex: none;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.controls :focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.controls button:disabled {
  cursor: default;
  opacity: 0.4;
}
.controls svg {
  width: 1rem;
  height: 1rem;
  fill: currentColor;
}
.controls .play {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  background: var(--segno-controls-accent, var(--segno-accent, #b3261e));
  color: #fff;
}
.play svg {
  width: 1.75rem;
  height: 1.75rem;
}
.control-button {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.625rem;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.controls button:not(:disabled):hover {
  filter: brightness(1.2);
}
.control-button:not(:disabled):hover {
  background: color-mix(in srgb, currentColor 20%, transparent);
}
.restart svg,
.settings-toggle svg {
  width: 1.5rem;
  height: 1.5rem;
}
.progress {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 0.5rem;
}
.time {
  flex: none;
  white-space: nowrap;
}
.seek {
  flex: 1;
  min-width: 2.5rem;
  height: 2.75rem;
  margin: 0;
  cursor: pointer;
}
.settings {
  display: flex;
  align-items: center;
  gap: var(--segno-controls-gap, 1.125rem);
  padding-left: 1.125rem;
  border-left: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.controls .settings-toggle {
  display: none;
}
.tempo {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.tempo > span:first-child {
  margin-right: 0.25rem;
}
.tempo .control-button {
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  font-size: 1.125rem;
}
.tempo-value {
  min-width: 2.75rem;
  text-align: center;
  font-weight: 700;
}
.tempo-bpm {
  margin-left: 0.25rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.mode,
.follow {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  gap: 0.5rem;
  white-space: nowrap;
}
.mode select {
  max-width: 8.5rem;
  min-height: 2.25rem;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 0.5rem;
  background: var(--segno-controls-background, #1d1c1a);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.follow {
  cursor: pointer;
}
.follow input {
  width: 1.125rem;
  height: 1.125rem;
  margin: 0;
}
@container segno-player (width < 44rem) {
  .controls {
    flex-wrap: wrap;
    gap: var(--segno-controls-gap, 0.5rem);
    padding: 0.625rem;
  }
  .controls .play {
    width: 2.75rem;
    height: 2.75rem;
  }
  .controls .restart,
  .settings-toggle {
    width: 2.5rem;
    height: 2.5rem;
  }
  .progress {
    gap: 0.375rem;
    font-size: 0.8125rem;
  }
  .seek {
    min-width: 1.5rem;
  }
  .controls .settings-toggle {
    display: grid;
  }
  .settings {
    display: none;
    flex-basis: 100%;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem 1.25rem;
    border-left: 0;
    border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    padding: 0.375rem 0 0;
  }
  .settings.is-open {
    display: flex;
  }
  .tempo .control-button {
    width: 2.75rem;
    height: 2.75rem;
  }
}
@container style(--segno-controls: compact) {
  .controls {
    flex-wrap: nowrap;
  }
  .time,
  .controls .restart,
  .controls .settings-toggle,
  .settings,
  .settings.is-open {
    display: none;
  }
}

.live,
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
`;

let sheet: CSSStyleSheet | undefined;

/** The stylesheet, shared by every player on the page */
export function styles(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  }
  return sheet;
}
