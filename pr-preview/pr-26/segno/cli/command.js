// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
/** Wrong arguments: exits 2, with a pointer to the command's help */
export class UsageError extends Error {
}
/** A command that can't do its work: exits 1, with an optional hint on what to fix */
export class CommandError extends Error {
    hint;
    constructor(message, hint) {
        super(message);
        this.hint = hint;
    }
}
/** The message of anything thrown */
export const messageOf = (error) => (error instanceof Error ? error.message : String(error));
//# sourceMappingURL=command.js.map