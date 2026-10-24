// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

// Builds the demo site into site/: the pages in demo/, stamped with the commit they were built from, and the
// built package under site/segno/, where the demo imports the player from.
// Links stay relative, so the site works at the Pages root and under pr-preview/pr-<n>/.
// Run `npm run build` first (`npm run build:demo` does both).
// @decision(DL-013) @decision(DL-020)

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

if (!existsSync('dist/player/index.js')) throw new Error('No built player in dist/: run npm run build first');

const commit = (process.env.SEGNO_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }))
  .trim()
  .slice(0, 7);

rmSync('site', { recursive: true, force: true });
cpSync('demo', 'site', { recursive: true });
// The score source and its matching MuseScore exports, including the attribution shown on the demo.
cpSync('fixtures/nar-juldagsmorgon-glimmar', 'site/scores/nar-juldagsmorgon-glimmar', { recursive: true });
// The modules only: no declarations or maps on the site
cpSync('dist', 'site/segno', { recursive: true, filter: (src) => !/\.(d\.ts|map)$/.test(src) });
const index = 'site/index.html';
writeFileSync(index, readFileSync(index, 'utf8').replaceAll('%COMMIT%', commit));
console.log(`Built the demo into site/ (${commit})`);
