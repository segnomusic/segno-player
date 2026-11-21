// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
import { access, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildSync, readViewBox } from '../core/index.js';
import { CommandError, messageOf, UsageError } from './command.js';
const help = `Usage: segno build-sync [<name>] [options]

Builds a sync map from a MuseScore export, for <segno-player sync="...">.

<name> is the export's path without an extension. "segno build-sync song" reads
song.mpos, song.spos (when there is one) and the pages song-1.svg, song-2.svg, ...,
and writes song.sync.json.

Options:
      --positions <file>  The bar positions, instead of <name>.mpos
      --notes <file>      The note positions, instead of <name>.spos
      --no-notes          Leave the note positions out (no note cursor)
      --page <file>       A page, instead of <name>-1.svg, ...; repeat it for each page, in order
  -o, --out <file>        Where to write the map, instead of <name>.sync.json; - for stdout
  -h, --help              Show this help
`;
const exportHint = 'The files must come from one MuseScore export of one score: one job, one MuseScore version, and the default PNG ' +
    'resolution. See https://github.com/segnomusic/segno-player#exporting-from-musescore';
const notesHint = 'Pass --no-notes to build the map without the note cursor.';
const options = {
    positions: { type: 'string' },
    notes: { type: 'string' },
    'no-notes': { type: 'boolean' },
    page: { type: 'string', multiple: true },
    out: { type: 'string', short: 'o' },
    help: { type: 'boolean', short: 'h' },
};
function parse(args) {
    try {
        return parseArgs({ args, options, allowPositionals: true });
    }
    catch (error) {
        throw new UsageError(messageOf(error));
    }
}
const exists = (path) => access(path).then(() => true, () => false);
// Node's messages repeat the path, which the CLI's messages already name
const reasons = {
    ENOENT: 'no such file or directory',
    EACCES: 'permission denied',
    EISDIR: 'is a directory',
};
const reasonOf = (error) => reasons[error.code ?? ''] ?? messageOf(error);
async function read(path, hint) {
    try {
        return await readFile(path, 'utf8');
    }
    catch (error) {
        throw new CommandError(`Can't read ${path}: ${reasonOf(error)}`, hint);
    }
}
// MuseScore numbers the pages from 1, even a single one; a glob would sort song-10.svg before song-2.svg
async function findPages(name) {
    const pages = [];
    while (await exists(`${name}-${pages.length + 1}.svg`))
        pages.push(`${name}-${pages.length + 1}.svg`);
    if (!pages.length)
        throw new CommandError(`No pages found: expected ${name}-1.svg`, 'Give the pages with --page.');
    return pages;
}
// Runs one step of the build, naming the file it was about when it fails
function step(file, hint, build) {
    try {
        return build();
    }
    catch (error) {
        throw new CommandError(`${file}: ${messageOf(error)}`, hint);
    }
}
const count = (n, what) => `${n} ${what}${n === 1 ? '' : 's'}`;
const size = (bytes) => (bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`);
function summary(sync, out, bytes) {
    const parts = [
        count(sync.pages?.length ?? 0, 'page'),
        count(sync.bars.length, 'bar'),
        count(sync.events.length, 'bar event'),
        sync.notes ? count(sync.notes.length, 'note') : 'no notes',
        size(bytes),
    ];
    return `Wrote ${out === '-' ? 'the sync map to stdout' : out}: ${parts.join(', ')}\n`;
}
/**
 * `segno build-sync`: finds a MuseScore export's files by name, builds its sync map and writes it.
 * @decision(DL-035) @decision(DL-036)
 */
export async function buildSyncCommand(args, io) {
    const { values, positionals } = parse(args);
    if (values.help) {
        io.out(help);
        return 0;
    }
    if (positionals.length > 1)
        throw new UsageError(`expected one export name, got ${positionals.length}`);
    if (values.notes !== undefined && values['no-notes'])
        throw new UsageError('--notes and --no-notes contradict');
    const name = positionals[0]?.replace(/\.mpos$/, '');
    if (name === '')
        throw new UsageError('the export name is empty');
    const positions = values.positions ?? (name === undefined ? undefined : `${name}.mpos`);
    const out = values.out ?? (name === undefined ? undefined : `${name}.sync.json`);
    if (positions === undefined || out === undefined || (name === undefined && !values.page)) {
        throw new UsageError('give an export name, or --positions, --page and --out');
    }
    // One file at a time, so that the first problem in this order is the one reported
    const mpos = await read(positions);
    let notes = values.notes;
    if (notes === undefined && !values['no-notes'] && name !== undefined && (await exists(`${name}.spos`))) {
        notes = `${name}.spos`;
    }
    const spos = notes === undefined ? undefined : await read(notes, notesHint);
    const sizes = [];
    for (const page of values.page ?? (await findPages(name ?? ''))) {
        const svg = await read(page);
        sizes.push(step(page, exportHint, () => readViewBox(svg)));
    }
    const bars = step(positions, exportHint, () => buildSync(mpos, sizes));
    const sync = notes === undefined || spos === undefined
        ? bars
        : step(notes, `${exportHint}\n${notesHint}`, () => buildSync(mpos, sizes, { sposXml: spos }));
    const json = `${JSON.stringify(sync)}\n`;
    if (out === '-') {
        io.out(json);
    }
    else {
        try {
            await writeFile(out, json);
        }
        catch (error) {
            throw new CommandError(`Can't write ${out}: ${reasonOf(error)}`);
        }
    }
    io.err(summary(sync, out, Buffer.byteLength(json)));
    return 0;
}
//# sourceMappingURL=build-sync.js.map