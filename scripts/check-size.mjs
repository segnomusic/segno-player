// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

// Checks the built entry points against their size budgets (minified size isn't measured: the
// published files stay readable, so this is the gzipped size of what tsc emits).
// @decision(DL-011) @decision(DL-023)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Directory under dist/ → budget in bytes, gzipped, for all its .js files together */
const budgets = {
  core: 4000,
  player: 24000,
};

let failed = false;
for (const [dir, budget] of Object.entries(budgets)) {
  const path = join('dist', dir);
  const files = readdirSync(path).filter((f) => f.endsWith('.js'));
  if (!files.length) throw new Error(`No .js files in ${path}: run npm run build first`);
  const size = gzipSync(Buffer.concat(files.map((f) => readFileSync(join(path, f))))).length;
  const ok = size <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok ' : 'OVER'} ${dir}: ${size} B gzipped (budget ${budget} B)`);
}
if (failed) process.exit(1);
