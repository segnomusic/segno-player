// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// CHROMIUM_PATH points Playwright at an installed Chromium instead of its own download
const chromium = process.env.CHROMIUM_PATH;

// @decision(DL-011) @decision(DL-019) @decision(DL-034)
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/test-*.ts', 'src/test/**'],
      reporter: ['text', 'html', 'json-summary'],
      // A floor that only goes up
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
    projects: [
      {
        extends: true,
        test: { name: 'core', include: ['src/core/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: { name: 'cli', include: ['src/cli/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'player',
          include: ['src/player/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: {
                args: ['--autoplay-policy=no-user-gesture-required'],
                ...(chromium ? { executablePath: chromium } : {}),
              },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
