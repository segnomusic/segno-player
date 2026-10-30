// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { cli } from './test-cli.js';

const metadata = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

describe('segno', () => {
  test('shows its help', async () => {
    for (const flag of ['--help', '-h']) {
      const { code, out, err } = await cli(flag);
      expect(code).toBe(0);
      expect(out).toMatch(/^Usage: segno <command>/);
      expect(out).toContain('build-sync');
      expect(err).toBe('');
    }
  });

  test('shows the package’s version', async () => {
    for (const flag of ['--version', '-v']) {
      expect(await cli(flag)).toEqual({ code: 0, out: `${metadata.version}\n`, err: '' });
    }
  });

  test('shows its usage on stderr without a command', async () => {
    const { code, out, err } = await cli();
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toMatch(/^Usage: segno <command>/);
  });

  test('rejects an unknown command', async () => {
    for (const name of ['build', 'toString']) {
      const { code, err } = await cli(name);
      expect(code).toBe(2);
      expect(err).toMatch(new RegExp(`^segno: unknown command "${name}"\n\nUsage:`));
    }
  });

  test('points at a command’s help for wrong arguments', async () => {
    const { code, err } = await cli('build-sync', '--bogus');
    expect(code).toBe(2);
    expect(err).toMatch(/^segno build-sync: .*--bogus/);
    expect(err).toContain('Run "segno build-sync --help" for its options.');
  });
});
