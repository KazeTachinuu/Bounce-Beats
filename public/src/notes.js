import { NOTES, play, unlock } from './audio.js';
import { ui } from './input.js';
import { hueFor } from './render.js';

// The note brush: a strip of the scale's notes. Arm one, then tap the canvas to
// place a line of exactly the length that plays it. Tap the chip again to disarm.
export function initNotes(strip, toggle) {
    const arm = (note) => {
        ui.brush = note;
        for (const chip of strip.children) chip.setAttribute('aria-pressed', chip.note === note);
    };

    strip.addEventListener('click', (e) => {
        const chip = e.target.closest('button');
        if (!chip) return;
        unlock();
        if (ui.brush === chip.note) return arm(null);
        arm(chip.note);
        play(chip.note, 900);
    });

    const show = (visible) => {
        strip.hidden = !visible;
        toggle.setAttribute('aria-pressed', visible);
        if (!visible) arm(null);
    };
    toggle.addEventListener('click', () => show(strip.hidden));

    function render() {
        strip.replaceChildren(...NOTES.map((note) => {
            const chip = document.createElement('button');
            chip.note = note;
            chip.textContent = note[0];
            chip.style.setProperty('--h', hueFor(note));
            return chip;
        }));
        arm(null);
    }
    render();

    return { refresh: render, disarm: () => arm(null), toggle: () => show(strip.hidden) };
}
