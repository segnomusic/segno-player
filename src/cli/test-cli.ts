// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './main.js';

/** Runs the command line and collects its exit code and output */
export async function cli(...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = '';
  let err = '';
  const code = await run(args, {
    out: (text) => {
      out += text;
    },
    err: (text) => {
      err += text;
    },
  });
  return { code, out, err };
}

const demo = fileURLToPath(
  new URL('../../fixtures/nar-juldagsmorgon-glimmar/nar-juldagsmorgon-glimmar', import.meta.url),
);

/**
 * A temporary directory holding the demo score's export as MuseScore names it: song.mpos, song.spos and song-1.svg.
 * Returns the directory and a function that removes it.
 */
export async function exportDirectory(): Promise<{ dir: string; remove: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'segno-cli-'));
  await Promise.all(['.mpos', '.spos', '-1.svg'].map((suffix) => copyFile(demo + suffix, join(dir, `song${suffix}`))));
  return { dir, remove: () => rm(dir, { recursive: true, force: true }) };
}
