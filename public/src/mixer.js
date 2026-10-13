import { NOTES, SCALES, KEYS, LEVELS, music, setScale, setVolume, play, unlock } from './audio.js';
import { save } from './scene.js';
import { hueFor } from './render.js';

const VOLUME_KEY = 'bounce-beats-volume';

// The Music panel: scale chips, key picker, one LED-style level bar per note, and the
// master volume. Bars can be painted by dragging across them; each change plays the
// note so you hear what you set.
export function initMixer(panel) {
    const scales = panel.querySelector('.scales');
    const key = panel.querySelector('.key select');
    const bars = panel.querySelector('.bars');
    const volume = panel.querySelector('.volume input');

    scales.append(...SCALES.map(([name], i) => {
        const button = document.createElement('button');
        button.textContent = name;
        button.addEventListener('click', () => changeScale(i, music.key));
        return button;
    }));
    key.append(...KEYS.map((name, i) => new Option(name, i)));
    key.addEventListener('change', () => changeScale(music.scale, Number(key.value)));

    try {
        const stored = Number(localStorage.getItem(VOLUME_KEY));
        if (localStorage.getItem(VOLUME_KEY) !== null && stored >= 0 && stored <= 1) setVolume(stored);
    } catch {}
    const showVolume = () => volume.style.setProperty('--p', `${volume.value * 100}%`);
    volume.value = music.volume;
    showVolume();
    volume.addEventListener('input', () => {
        setVolume(Number(volume.value));
        showVolume();
        try { localStorage.setItem(VOLUME_KEY, volume.value); } catch {}
    });

    // ---- bars ----

    const setLevel = (i, level) => {
        level = Math.max(0, Math.min(LEVELS, level));
        if (music.levels[i] === level) return;
        music.levels[i] = level;
        paintBar(i);
        save();
        if (level) play(NOTES[i], 700);
    };

    const paintBar = (i) => {
        const bar = bars.children[i];
        bar.setAttribute('aria-valuenow', music.levels[i]);
        bar.querySelectorAll('i').forEach((segment, s) => segment.classList.toggle('on', s < music.levels[i]));
    };

    // Pointer position to (bar, level): columns split the width, segments the height.
    const paintAt = (e) => {
        const stack = bars.querySelector('.stack').getBoundingClientRect();
        const area = bars.getBoundingClientRect();
        const i = Math.floor(((e.clientX - area.left) / area.width) * NOTES.length);
        const level = Math.round(((stack.bottom - e.clientY) / stack.height) * LEVELS);
        if (i >= 0 && i < NOTES.length) setLevel(i, level);
    };

    bars.addEventListener('pointerdown', (e) => {
        unlock();
        bars.setPointerCapture(e.pointerId);
        paintAt(e);
    });
    bars.addEventListener('pointermove', (e) => bars.hasPointerCapture(e.pointerId) && paintAt(e));
    bars.addEventListener('dblclick', (e) => {
        const i = [...bars.children].indexOf(e.target.closest('.bar'));
        if (i >= 0) setLevel(i, LEVELS);
    });
    bars.addEventListener('keydown', (e) => {
        const i = [...bars.children].indexOf(e.target.closest('.bar'));
        const step = { ArrowUp: 1, ArrowDown: -1 }[e.key];
        const move = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (step) setLevel(i, music.levels[i] + step);
        else if (move) bars.children[i + move]?.focus();
        else if (e.key === 'Home' || e.key === 'End') setLevel(i, e.key === 'End' ? LEVELS : 0);
        else return;
        e.preventDefault();
    });

    function render() {
        const octave = SCALES[music.scale][1].length;
        bars.style.setProperty('--n', NOTES.length);
        bars.replaceChildren(...NOTES.map((note, i) => {
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.tabIndex = 0;
            bar.role = 'slider';
            bar.ariaLabel = note[0];
            bar.ariaValueMin = 0;
            bar.ariaValueMax = LEVELS;
            bar.style.setProperty('--h', hueFor(note));
            const stack = document.createElement('span');
            stack.className = 'stack';
            stack.append(...Array.from({ length: LEVELS }, () => document.createElement('i')));
            const label = document.createElement('small');
            label.textContent = i % octave === 0 ? note[0] : '';
            bar.append(stack, label);
            return bar;
        }));
        NOTES.forEach((_, i) => paintBar(i));
        [...scales.children].forEach((button, i) => button.setAttribute('aria-pressed', i === music.scale));
        key.value = music.key;
    }

    function changeScale(scale, newKey) {
        unlock();
        setScale(scale, newKey);
        render();
        save();
        // A quick rising figure so the new scale is heard right away.
        const octave = SCALES[scale][1].length;
        [0, 2, 4, octave].forEach((i, n) => setTimeout(() => play(NOTES[i], 900), n * 110));
    }

    render();

    return {
        refresh: render,
        // Lights a bar when its note plays in the scene.
        pulse(note, strength) {
            const stack = bars.children[NOTES.indexOf(note)]?.firstChild;
            stack?.animate(
                [{ filter: `brightness(${1.6 + strength})` }, { filter: 'brightness(1)' }],
                { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' },
            );
        },
    };
}
