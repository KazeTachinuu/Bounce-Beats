import { NOTES, SCALES, INSTRUMENTS, LEVELS, music, setScale, play, unlock } from './audio.js';
import { save } from './scene.js';
import { hueFor } from './render.js';

// The Sound panel: scale, instrument, and one level bar per note. Drag across the
// bars to balance the notes (each change plays its note), drag to the bottom to
// mute one, double-click to reset. Bars glow as their notes play.
export function initSound(panel) {
    const scales = panel.querySelector('.scales');
    const instruments = panel.querySelector('.instruments');
    const bars = panel.querySelector('.bars');

    const chips = (container, names, onPick) => container.append(...names.map((name, i) => {
        const button = document.createElement('button');
        button.textContent = name;
        button.addEventListener('click', () => {
            unlock();
            onPick(i);
        });
        return button;
    }));
    chips(scales, SCALES.map(([name]) => name), (i) => changeScale(i));
    chips(instruments, INSTRUMENTS, (i) => {
        music.instrument = i;
        render();
        save();
        phrase();
    });

    // A short rising phrase, so a change is heard right away.
    const phrase = () => {
        const octave = SCALES[music.scale][1].length;
        [0, 2, 4, octave].forEach((i, n) => setTimeout(() => play(NOTES[i + octave], 900), n * 110));
    };

    function changeScale(scale) {
        setScale(scale);
        render();
        save();
        phrase();
    }

    // ---- level bars ----

    const setLevel = (i, level) => {
        level = Math.max(0, Math.min(LEVELS, level));
        if (music.levels[i] === level) return;
        music.levels[i] = level;
        paint(i);
        save();
        if (level) play(NOTES[i], 700);
    };

    const paint = (i) => {
        const bar = bars.children[i];
        bar.ariaValueNow = music.levels[i];
        bar.querySelectorAll('i').forEach((segment, s) => segment.classList.toggle('on', s < music.levels[i]));
    };

    // Pointer position to (bar, level): columns split the width, segments the height.
    const paintAt = (e) => {
        const stack = bars.querySelector('.stack').getBoundingClientRect();
        const area = bars.getBoundingClientRect();
        const i = Math.floor(((e.clientX - area.left) / area.width) * NOTES.length);
        if (i >= 0 && i < NOTES.length) setLevel(i, Math.round(((stack.bottom - e.clientY) / stack.height) * LEVELS));
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
        NOTES.forEach((_, i) => paint(i));
        [...scales.children].forEach((b, i) => b.setAttribute('aria-pressed', i === music.scale));
        [...instruments.children].forEach((b, i) => b.setAttribute('aria-pressed', i === music.instrument));
    }

    render();

    return {
        refresh: render,
        // Lights a bar when its note plays in the scene.
        pulse(note, strength) {
            bars.children[NOTES.indexOf(note)]?.firstChild.animate(
                [{ filter: `brightness(${1.6 + strength})` }, { filter: 'brightness(1)' }],
                { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' },
            );
        },
    };
}
