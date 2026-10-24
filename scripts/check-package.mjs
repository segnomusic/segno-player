// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

// @decision(DL-026)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'segno-package-'));

try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', directory], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  );
  assert.equal(packed.length, 1);
  const [tarball] = packed;
  assert.equal(tarball.name, metadata.name);
  assert.equal(tarball.version, metadata.version);
  const files = new Set(tarball.files.map(({ path }) => path));
  for (const path of [
    'dist/core/index.js',
    'dist/core/index.d.ts',
    'dist/player/index.js',
    'dist/player/index.d.ts',
    'LICENSE',
    'README.md',
    'package.json',
  ]) {
    assert.ok(files.has(path), `Missing package file: ${path}`);
  }
  assert.ok(![...files].some((path) => /(?:\.test\.ts$|\/test-[^/]+\.ts$)/.test(path)), 'Tests must not ship');

  const consumer = join(directory, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(directory, tarball.filename)], {
    cwd: consumer,
    stdio: 'inherit',
  });
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { buildSync, createTimeline, readViewBox } from '@segnomusic/player/core';
        import metadata from '@segnomusic/player/package.json' with { type: 'json' };
        await import('@segnomusic/player/player');
        assert.equal(metadata.name, ${JSON.stringify(metadata.name)});
        assert.equal(metadata.version, ${JSON.stringify(metadata.version)});
        assert.deepEqual(readViewBox('<svg viewBox="0 0 100 200"></svg>'), { w: 100, h: 200 });
        const sync = buildSync(
          '<score><elements><element id="0" x="0" y="0" sx="1200" sy="2400" page="0"/></elements><events><event elid="0" position="0"/></events></score>',
          [{ w: 100, h: 200 }],
        );
        assert.equal(sync.v, 1);
        assert.deepEqual(sync.bars, [[0, 0, 0, 1, 1]]);
        assert.equal(createTimeline(sync).at(0, 1000).bar, 0);
        assert.equal(typeof globalThis.customElements, 'undefined');
      `,
    ],
    { cwd: consumer, stdio: 'inherit' },
  );
  console.log(`ok: ${metadata.name}@${metadata.version} installs and runs from its tarball`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
