// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

/** Where a command writes: its output, and messages for the person running it */
export interface Io {
  out(text: string): void;
  err(text: string): void;
}

/** A command: its arguments after the command's name, and its exit code */
export type Command = (args: string[], io: Io) => Promise<number>;

/** Wrong arguments: exits 2, with a pointer to the command's help */
export class UsageError extends Error {}

/** A command that can't do its work: exits 1, with an optional hint on what to fix */
export class CommandError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

/** The message of anything thrown */
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
