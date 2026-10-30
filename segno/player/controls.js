// SPDX-License-Identifier: MIT
// Copyright (C) 2026 The Segno contributors
// https://github.com/segnomusic/segno-player
import { formatTime } from './format.js';
import { messages } from './localization.js';
const svgNS = 'http://www.w3.org/2000/svg';
const icons = {
    play: 'M4 2.5v11l9.5-5.5z',
    pause: 'M3.5 2h3v12h-3zM9.5 2h3v12h-3z',
    restart: 'M3 3h2v10H3zM13 3v10L6 8z',
    settings: 'M2 3h7v2H2zM11 3h3v2h-3zM8 2h3v4H8zM2 11h3v2H2zM7 11h7v2H7zM5 10h3v4H5z',
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
 * @decision(DL-016) @decision(DL-024) @decision(DL-029) @decision(DL-038)
 */
export function createControls(player, tempoSettings) {
    let text = messages.en;
    const bar = element('div', 'controls', 'controls');
    bar.setAttribute('role', 'group');
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
    seek.addEventListener('input', () => {
        player.currentTime = Number(seek.value);
    });
    progress.append(time, seek, totalTime);
    const settings = element('div', 'settings', 'settings', { id: 'playback-settings' });
    const settingsButton = element('button', 'settings-toggle control-button', 'settings-button', { type: 'button' });
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
    for (const value of ['auto', 'full', 'two-system', 'reflow']) {
        const option = document.createElement('option');
        option.value = value;
        mode.append(option);
    }
    mode.addEventListener('change', () => {
        player.mode = mode.value;
    });
    modeLabel.append(mode);
    settings.append(modeLabel);
    const tempo = element('div', 'tempo', 'tempo');
    tempo.setAttribute('role', 'group');
    const tempoLabel = document.createElement('span');
    const slower = element('button', 'control-button', 'tempo-decrease', { type: 'button', textContent: '−' });
    const faster = element('button', 'control-button', 'tempo-increase', { type: 'button', textContent: '+' });
    const rate = element('span', 'tempo-value', 'tempo-value');
    rate.setAttribute('aria-live', 'polite');
    const percentText = document.createTextNode('');
    // The quarter-note tempo: read out with the percentage, shown beside the buttons
    const bpmText = document.createElement('span');
    bpmText.className = 'visually-hidden';
    rate.append(percentText, bpmText);
    const bpm = element('span', 'tempo-bpm', 'tempo-bpm');
    bpm.setAttribute('aria-hidden', 'true');
    const stepTempo = (direction) => {
        const { min, max, step } = tempoSettings();
        // To a hundredth of a percent, so that fractional steps stay on their grid
        const percent = Math.round(player.playbackRate * 10_000) / 100;
        player.playbackRate = Math.min(max, Math.max(min, percent + direction * step)) / 100;
    };
    slower.addEventListener('click', () => stepTempo(-1));
    faster.addEventListener('click', () => stepTempo(1));
    tempo.append(tempoLabel, slower, rate, faster, bpm);
    const followLabel = element('label', 'follow', 'follow');
    const follow = element('input', '', 'follow-input', { type: 'checkbox' });
    follow.addEventListener('change', () => {
        player.follow = follow.checked;
    });
    const followText = document.createTextNode('');
    followLabel.append(follow, followText);
    settings.append(tempo, followLabel);
    const showState = () => {
        const paused = player.paused;
        path.setAttribute('d', paused ? icons.play : icons.pause);
        play.setAttribute('aria-label', paused ? text.play : text.pause);
    };
    const showTime = () => {
        const duration = Number.isFinite(player.duration) ? player.duration : 0;
        seek.max = String(duration);
        seek.value = String(player.currentTime);
        const now = formatTime(player.currentTime);
        const total = formatTime(duration);
        time.textContent = now;
        totalTime.textContent = total;
        seek.setAttribute('aria-valuetext', text.seekPosition(now, total));
        play.disabled = restart.disabled = seek.disabled = duration <= 0;
    };
    const showRate = () => {
        const { min, max, base } = tempoSettings();
        const percent = Math.round(player.playbackRate * 100);
        percentText.data = text.tempoPercent(percent);
        slower.disabled = percent <= min;
        faster.disabled = percent >= max;
        const quarters = base === null ? 0 : Math.round(base * player.playbackRate);
        bpm.hidden = base === null;
        bpm.textContent = `♩ = ${quarters}`;
        bpmText.textContent = base === null ? '' : `, ${text.tempoQuarters(quarters)}`;
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
    const setLanguage = (language) => {
        text = messages[language];
        bar.lang = language;
        bar.setAttribute('aria-label', text.player);
        restart.setAttribute('aria-label', text.restart);
        seek.setAttribute('aria-label', text.position);
        settingsButton.setAttribute('aria-label', text.playbackSettings);
        mode.setAttribute('aria-label', text.scoreLayout);
        for (const option of mode.options)
            option.textContent = text.modes[option.value];
        tempo.setAttribute('aria-label', text.tempo);
        tempoLabel.textContent = text.tempo;
        slower.setAttribute('aria-label', text.slower);
        faster.setAttribute('aria-label', text.faster);
        followText.textContent = text.followScore;
        refresh();
    };
    const refresh = () => {
        showState();
        showTime();
        showRate();
    };
    setLanguage('en');
    showFollow();
    showMode();
    bar.append(play, restart, progress, settingsButton, settings);
    return { root: bar, setLanguage, refresh };
}
//# sourceMappingURL=controls.js.map