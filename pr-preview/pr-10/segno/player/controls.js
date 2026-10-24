// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
import { formatTime } from './format.js';
const svgNS = 'http://www.w3.org/2000/svg';
const icons = {
    play: 'M4 2.5v11l9.5-5.5z',
    pause: 'M3.5 2h3v12h-3zM9.5 2h3v12h-3z',
    restart: 'M3 3h2v10H3zM13 3v10L6 8z',
    settings: 'M2 3h7v2H2zM11 3h3v2h-3zM8 2h3v4H8zM2 11h3v2H2zM7 11h7v2H7zM5 10h3v4H5z',
};
const TEMPO_MIN = 50;
const TEMPO_MAX = 150;
const TEMPO_STEP = 10;
const MODE_NAMES = {
    auto: 'Auto',
    full: 'Full score',
    'two-system': 'Zoom',
    reflow: 'Reflow',
};
// An element with a class name, a part and some properties
function element(tag, name, part, props = {}) {
    const el = Object.assign(document.createElement(tag), props);
    el.className = name;
    el.setAttribute('part', part);
    return el;
}
/**
 * The built-in controls: playback and seeking, with tempo and follow settings that collapse on narrow players.
 * @decision(DL-016) @decision(DL-024)
 */
export function createControls(player) {
    const bar = element('div', 'controls', 'controls');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Player');
    const play = element('button', 'play', 'play-button', { type: 'button' });
    const addIcon = (button, name) => {
        const icon = document.createElementNS(svgNS, 'svg');
        icon.setAttribute('viewBox', '0 0 16 16');
        icon.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', icons[name]);
        icon.append(path);
        button.append(icon);
        return path;
    };
    const path = addIcon(play, 'play');
    play.addEventListener('click', () => {
        if (player.paused)
            player.play().catch(() => { });
        else
            player.pause();
    });
    const restart = element('button', 'restart control-button', 'restart-button', { type: 'button' });
    restart.setAttribute('aria-label', 'Back to beginning');
    addIcon(restart, 'restart');
    restart.addEventListener('click', () => {
        player.pause();
        player.currentTime = 0;
    });
    const progress = document.createElement('div');
    progress.className = 'progress';
    const time = element('span', 'time elapsed', 'time current-time');
    const totalTime = element('span', 'time duration', 'time duration');
    const seek = element('input', 'seek', 'seek', { type: 'range', min: '0', max: '0', step: 'any' });
    seek.setAttribute('aria-label', 'Position');
    seek.addEventListener('input', () => {
        player.currentTime = Number(seek.value);
    });
    progress.append(time, seek, totalTime);
    const settings = element('div', 'settings', 'settings', { id: 'playback-settings' });
    const settingsButton = element('button', 'settings-toggle control-button', 'settings-button', { type: 'button' });
    settingsButton.setAttribute('aria-label', 'Playback settings');
    settingsButton.setAttribute('aria-controls', settings.id);
    settingsButton.setAttribute('aria-expanded', 'false');
    addIcon(settingsButton, 'settings');
    const toggleSettings = (open) => {
        settings.classList.toggle('is-open', open);
        settingsButton.setAttribute('aria-expanded', String(open));
    };
    settingsButton.addEventListener('click', () => toggleSettings(!settings.classList.contains('is-open')));
    settings.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !settingsButton.checkVisibility())
            return;
        toggleSettings(false);
        settingsButton.focus();
        event.preventDefault();
    });
    const modeLabel = element('label', 'mode', 'mode');
    const mode = element('select', '', 'mode-input');
    mode.setAttribute('aria-label', 'Score layout');
    for (const value of ['auto', 'full', 'two-system', 'reflow']) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = MODE_NAMES[value];
        mode.append(option);
    }
    mode.addEventListener('change', () => {
        player.mode = mode.value;
    });
    modeLabel.append(mode);
    settings.append(modeLabel);
    const tempo = element('div', 'tempo', 'tempo');
    tempo.setAttribute('role', 'group');
    tempo.setAttribute('aria-label', 'Tempo');
    const tempoLabel = document.createElement('span');
    tempoLabel.textContent = 'Tempo';
    const slower = element('button', 'control-button', 'tempo-decrease', { type: 'button', textContent: '−' });
    slower.setAttribute('aria-label', 'Slower');
    const faster = element('button', 'control-button', 'tempo-increase', { type: 'button', textContent: '+' });
    faster.setAttribute('aria-label', 'Faster');
    const rate = element('span', 'tempo-value', 'tempo-value');
    rate.setAttribute('aria-live', 'polite');
    const stepTempo = (step) => {
        const percent = Math.round(player.playbackRate * 100);
        player.playbackRate = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, percent + step)) / 100;
    };
    slower.addEventListener('click', () => stepTempo(-TEMPO_STEP));
    faster.addEventListener('click', () => stepTempo(TEMPO_STEP));
    tempo.append(tempoLabel, slower, rate, faster);
    const followLabel = element('label', 'follow', 'follow');
    const follow = element('input', '', 'follow-input', { type: 'checkbox' });
    follow.addEventListener('change', () => {
        player.follow = follow.checked;
    });
    followLabel.append(follow, 'Follow score');
    settings.append(tempo, followLabel);
    const showState = () => {
        const paused = player.paused;
        path.setAttribute('d', paused ? icons.play : icons.pause);
        play.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    };
    const showTime = () => {
        const duration = Number.isFinite(player.duration) ? player.duration : 0;
        seek.max = String(duration);
        seek.value = String(player.currentTime);
        const now = formatTime(player.currentTime);
        const total = formatTime(duration);
        time.textContent = now;
        totalTime.textContent = total;
        seek.setAttribute('aria-valuetext', `${now} of ${total}`);
        play.disabled = restart.disabled = seek.disabled = duration <= 0;
    };
    const showRate = () => {
        const percent = Math.round(player.playbackRate * 100);
        rate.textContent = `${percent}%`;
        slower.disabled = percent <= TEMPO_MIN;
        faster.disabled = percent >= TEMPO_MAX;
    };
    const showFollow = () => {
        follow.checked = player.follow;
    };
    const showMode = () => {
        mode.value = player.mode;
    };
    for (const type of ['play', 'pause', 'ended', 'emptied'])
        player.addEventListener(type, showState);
    for (const type of ['timeupdate', 'durationchange', 'seeked', 'emptied'])
        player.addEventListener(type, showTime);
    player.addEventListener('ratechange', showRate);
    player.addEventListener('followchange', showFollow);
    player.addEventListener('modechange', showMode);
    showState();
    showTime();
    showRate();
    showFollow();
    showMode();
    bar.append(play, restart, progress, settingsButton, settings);
    return bar;
}
//# sourceMappingURL=controls.js.map