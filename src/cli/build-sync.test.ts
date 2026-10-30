// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { buildSync, readViewBox, type SyncMap } from '../core/index.js';
import { cli, exportDirectory } from './test-cli.js';

let dir: string;
let remove: () => Promise<void>;
let song: string;

beforeEach(async () => {
  ({ dir, remove } = await exportDirectory());
  song = join(dir, 'song');
});
afterEach(() => remove());

const text = (path: string): Promise<string> => readFile(path, 'utf8');
const written = async (path = `${song}.sync.json`): Promise<SyncMap> => JSON.parse(await text(path));

async function expected(notes = true): Promise<SyncMap> {
  const pages = [readViewBox(await text(`${song}-1.svg`))];
  return buildSync(await text(`${song}.mpos`), pages, notes ? { sposXml: await text(`${song}.spos`) } : {});
}

describe('segno build-sync', () => {
  test('builds the map from an export’s name and writes it next to it', async () => {
    const { code, out, err } = await cli('build-sync', song);
    expect(code).toBe(0);
    expect(out).toBe('');
    expect(await written()).toEqual(await expected());
    const json = await text(`${song}.sync.json`);
    expect(json).toBe(`${JSON.stringify(await expected())}\n`);
    expect(err).toBe(`Wrote ${song}.sync.json: 1 page, 13 bars, 17 bar events, 33 notes, 2.0 KB\n`);
  });

  test('accepts the .mpos file as the name', async () => {
    expect((await cli('build-sync', `${song}.mpos`)).code).toBe(0);
    expect(await written()).toEqual(await expected());
  });

  test('builds a map without notes when there is no .spos, or with --no-notes', async () => {
    expect((await cli('build-sync', '--no-notes', song)).err).toMatch(/17 bar events, no notes, \d+ B\n$/);
    expect(await written()).toEqual(await expected(false));
    await rm(`${song}.spos`);
    expect((await cli('build-sync', song)).code).toBe(0);
    expect(await written()).toEqual(await expected(false));
  });

  test('counts the pages up from 1 to the first missing one', async () => {
    await copyFile(`${song}-1.svg`, `${song}-2.svg`);
    await copyFile(`${song}-1.svg`, `${song}-4.svg`);
    const { err } = await cli('build-sync', song);
    expect(err).toContain(': 2 pages, 13 bars');
    expect((await written()).pages).toHaveLength(2);
  });

  test('writes to stdout with -o -', async () => {
    const { code, out, err } = await cli('build-sync', song, '-o', '-');
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual(await expected());
    expect(err).toMatch(/^Wrote the sync map to stdout: 1 page/);
  });

  test('takes each file from its option instead of the name', async () => {
    const other = join(dir, 'other');
    for (const suffix of ['.mpos', '.spos']) await copyFile(`${song}${suffix}`, `${other}${suffix}`);
    await copyFile(`${song}-1.svg`, join(dir, 'page.svg'));
    const map = await expected();
    const out = join(dir, 'map.json');
    const args = ['--positions', `${other}.mpos`, '--notes', `${other}.spos`, '--page', join(dir, 'page.svg')];
    expect((await cli('build-sync', ...args, '--out', out)).code).toBe(0);
    expect(await written(out)).toEqual(map);
    // The name still gives the rest
    await writeFile(`${song}.mpos`, 'not used');
    expect((await cli('build-sync', song, '--positions', `${other}.mpos`)).code).toBe(0);
    expect(await written()).toEqual(map);
  });

  test('uses the pages given with --page, in their order, instead of looking for them', async () => {
    const page = join(dir, 'page.svg');
    const small = join(dir, 'small.svg');
    const demoPage = (await expected()).pages?.[0];
    await copyFile(`${song}-1.svg`, page);
    await writeFile(small, '<svg viewBox="0 0 100 200"></svg>');
    await rm(`${song}-1.svg`);
    expect((await cli('build-sync', song, '--page', page, '--page', small)).code).toBe(0);
    const [first, second] = (await written()).pages ?? [];
    expect(first).toEqual(demoPage);
    expect(second).toEqual([100, 200]);
    // The bars are on the first page, which doesn't fit them when it is the small one
    const swapped = await cli('build-sync', song, '--page', small, '--page', page);
    expect(swapped.code).toBe(1);
    expect(swapped.err).toContain('falls outside its page');
  });

  test('shows its help', async () => {
    const { code, out } = await cli('build-sync', '--help');
    expect(code).toBe(0);
    expect(out).toMatch(/^Usage: segno build-sync \[<name>\] \[options\]/);
  });

  test('rejects wrong arguments', async () => {
    const usage = async (...args: string[]): Promise<string> => {
      const { code, err } = await cli('build-sync', ...args);
      expect(code).toBe(2);
      return err;
    };
    expect(await usage()).toContain('give an export name, or --positions, --page and --out');
    expect(await usage('--positions', `${song}.mpos`, '--page', `${song}-1.svg`)).toContain('give an export name');
    expect(await usage(song, 'other')).toContain('expected one export name, got 2');
    expect(await usage('')).toContain('the export name is empty');
    expect(await usage(song, '--notes', `${song}.spos`, '--no-notes')).toContain('--notes and --no-notes contradict');
    expect(await usage(song, '--out')).toContain("--out <value>' argument missing");
  });

  test('fails when a file is missing', async () => {
    await rm(`${song}.mpos`);
    const { code, err } = await cli('build-sync', song);
    expect(code).toBe(1);
    expect(err).toBe(`segno build-sync: Can't read ${song}.mpos: no such file or directory\n`);

    // A mistyped name is reported as its missing .mpos, not as missing pages
    const typo = await cli('build-sync', join(dir, 'sogn'));
    expect(typo.code).toBe(1);
    expect(typo.err).toContain(`Can't read ${join(dir, 'sogn')}.mpos: no such file or directory\n`);
    expect(typo.err).not.toContain('--page');

    await copyFile(join(dir, 'song.spos'), `${song}.mpos`);
    const pages = await cli('build-sync', join(dir, 'other'), '--positions', `${song}.mpos`);
    expect(pages.code).toBe(1);
    expect(pages.err).toContain(`No pages found: expected ${join(dir, 'other')}-1.svg\nGive the pages with --page.`);
  });

  test('fails, with a hint, when the notes are missing or do not fit', async () => {
    const missing = await cli('build-sync', song, '--notes', join(dir, 'missing.spos'));
    expect(missing.code).toBe(1);
    expect(missing.err).toContain('missing.spos: no such file or directory\nPass --no-notes');

    await writeFile(`${song}.spos`, '<score/>');
    const wrong = await cli('build-sync', song);
    expect(wrong.code).toBe(1);
    expect(wrong.err).toContain(`${song}.spos: Not a MuseScore positions file`);
    expect(wrong.err).toMatch(/one MuseScore version.*\nPass --no-notes to build the map without the note cursor\.\n$/);
    await expect(text(`${song}.sync.json`)).rejects.toThrow();
  });

  test('fails, with a hint, when the positions do not fit the pages', async () => {
    await writeFile(`${song}-1.svg`, '<svg viewBox="0 0 100 100"></svg>');
    const outside = await cli('build-sync', song);
    expect(outside.code).toBe(1);
    expect(outside.err.startsWith(`segno build-sync: ${song}.mpos: Bar 0 falls outside its page`)).toBe(true);
    expect(outside.err).toContain('the default PNG resolution');

    await writeFile(`${song}-1.svg`, '<svg></svg>');
    const noViewBox = await cli('build-sync', song);
    expect(noViewBox.code).toBe(1);
    expect(noViewBox.err).toContain(`${song}-1.svg: SVG without a viewBox`);
  });

  test('fails when the map cannot be written', async () => {
    const { code, err } = await cli('build-sync', song, '-o', join(dir, 'missing', 'map.json'));
    expect(code).toBe(1);
    expect(err).toBe(`segno build-sync: Can't write ${join(dir, 'missing', 'map.json')}: no such file or directory\n`);
  });
});
