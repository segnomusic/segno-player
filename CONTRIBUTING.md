# Contributing to Segno

Thanks for helping. Bug reports, fixes, test scores and documentation are all welcome. For a larger change, open an issue first so we can agree on the approach before you spend time on it.

## Setup

You need Node.js 22 or later.

```sh
git clone https://github.com/segnomusic/segno-player.git
cd segno-player
npm install
npm test
```

The player's tests run in Chromium through Playwright. `npx playwright install chromium` downloads it once; to use a Chromium you already have, point `CHROMIUM_PATH` at its executable instead.

`npm run demo` builds the demo site and serves it locally, to try the player with your own exports.

## Checks

CI runs these on every pull request; `npm run check` runs them all locally:

| Command                         | What it checks                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`             | TypeScript, strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`)             |
| `npm run lint`                  | Biome: lint and format. `npm run lint:fix` fixes what it can                                                              |
| `npm run license-headers`       | Every source file starts with `// SPDX-License-Identifier: MIT`                                                           |
| `npm run coverage`              | Vitest (the core in Node, the player in Chromium), with at least 90% of lines, functions, branches and statements covered |
| `npm run build`, `npm run size` | The build, and its gzipped size against the budget in `scripts/check-size.mjs`                                            |

The coverage floor only goes up: if your change raises coverage, you may raise the thresholds in `vitest.config.ts`.

## Code

- TypeScript, ESM only. No `any`.
- The core (`src/core`) has no runtime dependencies and uses no DOM APIs, so it runs in Node and in browsers. Keep it that way.
- New source files start with the SPDX header:

  ```ts
  // SPDX-License-Identifier: MIT
  // Copyright (C) 2026 The Segno contributors
  // https://github.com/segnomusic/segno-player
  ```

## Previews

Every pull request from a branch of this repository gets a preview of the demo site at `https://segnomusic.github.io/segno-player/pr-preview/pr-<number>/`, linked in a comment on the pull request. Pull requests from forks don't get one yet. Build the demo locally with `npm run build:demo` and open `site/index.html`.

## Decisions

Design decisions are recorded with [DLD](https://github.com/jimutt/dld-kit) (Decision-Linked Development) in [`decisions/records/`](decisions/INDEX.md), and code links to them with `@decision(DL-NNN)` comments. Before changing code that carries one, read the decision. A change that goes against a decision needs a new decision that supersedes or amends it; propose it in the pull request. AI coding agents (Claude Code, OpenCode) get the DLD skills and rules from `.claude/`, `.agents/` and `AGENTS.md`.

Write decisions for strangers: the problem, the choice, and the reasoning, with how anything claimed was verified.

## Test scores

Fixtures and demo scores must be in the public domain or under an open licence. Add each one to [fixtures/SOURCES.md](fixtures/SOURCES.md) with its source and licence. Export them from the original score file (`.mscz`), not through MusicXML, which can change endings and repeats.

## Releases

Every pull request that changes the published package adds a changeset: run `npx changeset` and describe the change for users. Merging to `main` opens a "Version Packages" pull request; merging that publishes to npm.

## Licence

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE), the same as the rest of the project.
