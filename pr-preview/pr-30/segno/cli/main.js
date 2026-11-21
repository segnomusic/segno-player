// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
/**
 * The `segno` command line: prepares the player's inputs ahead of time.
 * @decision(DL-034)
 * @module
 */
import { readFile } from 'node:fs/promises';
import { buildSyncCommand } from './build-sync.js';
import { CommandError, messageOf, UsageError } from './command.js';
const commands = {
    'build-sync': buildSyncCommand,
};
const usage = `Usage: segno <command> [options]

Commands:
  build-sync     Build a sync map from a MuseScore export

Options:
  -h, --help     Show this help
  -v, --version  Show the version

Run "segno <command> --help" for a command's options.
`;
// The same relative path from src/cli and dist/cli
async function version() {
    const metadata = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
    return String(metadata.version);
}
/**
 * Runs the command line with its arguments (without `node` and the script) and returns the exit code: 0 when
 * done, 1 when a command fails, 2 for wrong arguments.
 */
export async function run(args, io) {
    const [name, ...rest] = args;
    if (name === '-h' || name === '--help') {
        io.out(usage);
        return 0;
    }
    if (name === '-v' || name === '--version') {
        try {
            io.out(`${await version()}\n`);
            return 0;
        }
        catch (error) {
            io.err(`segno: ${messageOf(error)}\n`);
            return 1;
        }
    }
    const command = name !== undefined && Object.hasOwn(commands, name) ? commands[name] : undefined;
    if (!command) {
        io.err(name === undefined ? usage : `segno: unknown command "${name}"\n\n${usage}`);
        return 2;
    }
    try {
        return await command(rest, io);
    }
    catch (error) {
        if (error instanceof UsageError) {
            io.err(`segno ${name}: ${error.message}\nRun "segno ${name} --help" for its options.\n`);
            return 2;
        }
        io.err(`segno ${name}: ${messageOf(error)}\n`);
        if (error instanceof CommandError && error.hint)
            io.err(`${error.hint}\n`);
        return 1;
    }
}
//# sourceMappingURL=main.js.map