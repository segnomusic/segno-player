// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

// @decision(DL-026) @decision(DL-032) @decision(DL-034)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, preview } from 'vite';

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
    'dist/cli/index.js',
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
        const { SegnoPlayer } = await import('@segnomusic/player');
        assert.equal(typeof SegnoPlayer, 'function');
        assert.equal(metadata.exports['.'].default, './dist/player/index.js');
        assert.equal(metadata.exports['.'].types, './dist/player/index.d.ts');
        assert.equal(Object.hasOwn(metadata.exports, './player'), false);
        await assert.rejects(import('@segnomusic/player/player'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
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
  const segno = join(consumer, 'node_modules/.bin/segno');
  assert.equal(execFileSync(segno, ['--version'], { encoding: 'utf8' }), `${metadata.version}\n`);
  const demo = join(root, 'fixtures/nar-juldagsmorgon-glimmar/nar-juldagsmorgon-glimmar');
  for (const suffix of ['.mpos', '.spos', '-1.svg']) copyFileSync(`${demo}${suffix}`, join(consumer, `song${suffix}`));
  execFileSync(segno, ['build-sync', 'song'], { cwd: consumer, stdio: 'inherit' });
  const built = JSON.parse(readFileSync(join(consumer, 'song.sync.json'), 'utf8'));
  assert.equal(built.v, 1);
  assert.equal(built.pages.length, 1);
  assert.equal(built.bars.length, 13);
  assert.equal(built.notes.length, 33);
  writeFileSync(
    join(consumer, 'imports.ts'),
    `
      import { SegnoPlayer, type BarChangeDetail, type ModeChangeDetail, type ResolvedScoreMode, type ScoreMode, type SegnoMedia } from '@segnomusic/player';
      import { buildSync, type SyncMap } from '@segnomusic/player/core';
      const loaded: typeof SegnoPlayer = (await import('@segnomusic/player')).SegnoPlayer;
      export const player: SegnoPlayer = new loaded();
      export const mode: ScoreMode = player.mode;
      export const resolved: ResolvedScoreMode = player.resolvedMode;
      export const bar: BarChangeDetail = { bar: 0, event: 0 };
      export const change: ModeChangeDetail = { mode, resolvedMode: resolved };
      export const media: SegnoMedia | null = player.media ?? document.createElement('audio');
      export const map: SyncMap = buildSync('', []);
      // @ts-expect-error The component subpath was removed in 0.3.0.
      await import('@segnomusic/player/player');
    `,
  );
  for (const module of ['NodeNext', 'Preserve']) {
    writeFileSync(
      join(consumer, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module,
          moduleResolution: module === 'NodeNext' ? 'NodeNext' : 'Bundler',
          target: 'ES2023',
          strict: true,
          noEmit: true,
          types: [],
        },
        files: ['imports.ts'],
      }),
    );
    execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], {
      cwd: consumer,
      stdio: 'inherit',
    });
  }
  writeFileSync(
    join(consumer, 'index.html'),
    '<!doctype html><segno-player controls></segno-player><script type="module" src="./register.js"></script>',
  );
  writeFileSync(join(consumer, 'register.js'), "import '@segnomusic/player';");
  writeFileSync(
    join(consumer, 'lazy.html'),
    '<!doctype html><button id="load">Load player</button><segno-player controls></segno-player><script type="module" src="./lazy.js"></script>',
  );
  writeFileSync(
    join(consumer, 'lazy.js'),
    `
      document.querySelector('#load').addEventListener('click', async () => {
        const { SegnoPlayer } = await import('@segnomusic/player');
        const again = await import('@segnomusic/player');
        if (again.SegnoPlayer !== SegnoPlayer) throw new Error('Duplicate player module');
        document.documentElement.dataset.loaded = 'yes';
      });
    `,
  );
  await build({
    root: consumer,
    configFile: false,
    logLevel: 'error',
    build: { rollupOptions: { input: [join(consumer, 'index.html'), join(consumer, 'lazy.html')] } },
  });
  const server = await preview({
    root: consumer,
    configFile: false,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 0 },
  });
  try {
    const browser = await chromium.launch({
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    });
    try {
      const base = server.resolvedUrls.local[0];
      for (const path of ['index.html', 'lazy.html']) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(new URL(path, base).href);
        if (path === 'lazy.html') {
          assert.equal(await page.evaluate(() => customElements.get('segno-player')), undefined);
          await page.click('#load');
          await page.waitForFunction(() => document.documentElement.dataset.loaded === 'yes');
        }
        assert.equal(
          await page.evaluate(() => {
            const element = document.querySelector('segno-player');
            return element instanceof customElements.get('segno-player') && element.shadowRoot !== null;
          }),
          true,
        );
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await new Promise((resolve, reject) => server.httpServer.close((error) => (error ? reject(error) : resolve())));
  }
  console.log(`ok: ${metadata.name}@${metadata.version} installs and runs from its tarball`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
