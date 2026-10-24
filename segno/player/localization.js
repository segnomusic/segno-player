// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
export const messages = {
    en: {
        player: 'Player',
        score: 'Score',
        play: 'Play',
        pause: 'Pause',
        restart: 'Back to beginning',
        position: 'Position',
        playbackSettings: 'Playback settings',
        scoreLayout: 'Score layout',
        modes: { auto: 'Auto', full: 'Full score', 'two-system': 'Zoom', reflow: 'Reflow' },
        tempo: 'Tempo',
        slower: 'Slower',
        faster: 'Faster',
        followScore: 'Follow score',
        seekPosition: (now, total) => `${now} of ${total}`,
        tempoPercent: (percent) => `${percent}%`,
        pageDescription: (page, total, title) => title ? `${title}, page ${page} of ${total}` : `Page ${page} of ${total}`,
        zoomedScore: (title) => (title ? `${title}, zoomed score` : 'Zoomed score'),
        barPosition: (bar, total) => `Bar ${bar} of ${total}`,
    },
    sv: {
        player: 'Spelare',
        score: 'Notbild',
        play: 'Spela',
        pause: 'Pausa',
        restart: 'Till början',
        position: 'Position',
        playbackSettings: 'Uppspelningsinställningar',
        scoreLayout: 'Notlayout',
        modes: { auto: 'Auto', full: 'Hela bladet', 'two-system': 'Zoom', reflow: 'Anpassad' },
        tempo: 'Tempo',
        slower: 'Långsammare',
        faster: 'Snabbare',
        followScore: 'Följ noterna',
        seekPosition: (now, total) => `${now} av ${total}`,
        tempoPercent: (percent) => `${percent}\u00a0%`,
        pageDescription: (page, total, title) => title ? `${title}, sida ${page} av ${total}` : `Sida ${page} av ${total}`,
        zoomedScore: (title) => (title ? `${title}, inzoomad notbild` : 'Inzoomad notbild'),
        barPosition: (bar, total) => `Takt ${bar} av ${total}`,
    },
};
// @decision(DL-028)
export function languageOf(element) {
    return element.matches(':lang(sv)') ? 'sv' : 'en';
}
//# sourceMappingURL=localization.js.map