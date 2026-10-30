// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

// Checks that every source file starts with the licence's SPDX header (after a shebang, in the CLI's bin).
// @decision(DL-007) @decision(DL-034)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const header = '// SPDX-License-Identifier: MIT';
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.ts', '*.js', '*.mjs'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => f && !f.startsWith('.claude/') && !f.startsWith('.agents/'));
const missing = files.filter(
  (f) =>
    !readFileSync(f, 'utf8')
      .replace(/^#!.*\n/, '')
      .startsWith(header),
);
if (missing.length) {
  console.error(`Missing "${header}" on the first line (or the one after a shebang):\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`ok: ${files.length} source files carry the SPDX header`);
