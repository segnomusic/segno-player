// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/jimutt/segno
/**
 * `<segno-player>`. Importing this module defines the element (once, and only where there is a DOM).
 * @decision(DL-018)
 * @module
 */
import { SegnoPlayer } from './element.js';
// Without a DOM (server rendering, build scripts) importing it does nothing
if (globalThis.customElements && !customElements.get('segno-player')) {
    customElements.define('segno-player', SegnoPlayer);
}
export { SegnoPlayer } from './element.js';
//# sourceMappingURL=index.js.map