# The sync map format

<!-- @decision(DL-003) @decision(DL-036) -->

A sync map holds everything a player needs to follow a score's audio on its pages: where each bar (and, optionally, each note) is on the page, and when it plays. `buildSync()` makes one from MuseScore's position files and the sizes of the SVG pages; `createTimeline()` answers lookups over it. It is plain JSON, about 2 KB for a song, so it can be built once at build time and shipped with a page, or built in the browser.

## Version 1

```json
{
  "v": 1,
  "pages": [[9921.26, 14031.5]],
  "bars": [[0, 0.11309, 0.15675, 0.14102, 0.14543]],
  "events": [[0, 0], [1, 522]],
  "notes": [[0, 0.1901, 0.15675, 0.14543]],
  "noteEvents": [[0, 0], [1, 261]]
}
```

| Field        | Content                                                                                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`          | The format version: `1`.                                                                                                                                                                                                                                            |
| `pages`      | Optional. One `[w, h]` per page, in page order: the page's size from its SVG's `viewBox`, in the SVG's own units. Only the ratio of `w` to `h` is meaningful; a player uses it to reserve each page's shape before the image loads. `buildSync()` always writes it. |
| `bars`       | One `[page, x, y, w, h]` per bar, in score order. `page` is the zero-based page index; `x`, `y` are the bar's top-left corner and `w`, `h` its size, as fractions of the page (0–1). `y` and `h` span the whole system, all staves.                                 |
| `events`     | `[bar, ms]` in playback order: `bar` is an index into `bars`, `ms` the time it starts in the audio. Repeats, voltas, D.C./D.S., codas and fine are already unrolled, so a bar inside a repeat appears more than once. Times never decrease.                         |
| `notes`      | Optional, present when built with an `.spos` file. One `[page, x, y, h]` per note or rest position (a segment, across all voices and staves): `x` is the estimated centre of the noteheads, `y` and `h` the system.                                                 |
| `noteEvents` | Present with `notes`: `[note, ms]` in playback order, `note` being an index into `notes`.                                                                                                                                                                           |

All fractions are rounded to 5 decimals: a hundred-thousandth of an A4 page is 3 µm, far below what any screen shows.

Because positions are fractions of the page, a player can show the pages at any size: it places a box at `x × 100%` of the displayed page's width, and so on.

## Versioning

`v` changes whenever a reader of an older version would misread a new map: fields removed or renamed, or a meaning changed. Adding an optional field that older readers can ignore keeps the version. Readers should reject a version they don't know rather than guess.

## Producing a sync map elsewhere

Anything can write a sync map, not only `buildSync()`: a converter service, another engraver's positions, hand-made data for a test. What the player relies on:
- every index in `events` and `noteEvents` points into `bars` and `notes`;
- times in `events` (and in `noteEvents`) never decrease;
- the boxes lie on their pages (0–1), and `page` is a page the player is given;
- when `pages` is present, it has one entry per page the player is given, and every `page` index is within it.
