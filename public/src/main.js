import { scene, world, addBall, load, save, edit, clearAll, undo, redo } from './scene.js';
import { step } from './physics.js';
import { play, noteFor, NOTES, SCALES, music, setScale } from './audio.js';
import * as render from './render.js';
import { initInput, ui, select, selectionBox, deleteSelection, cursor } from './input.js';
import { titleBalls } from './intro.js';
import { initSound } from './sound.js';

const HIT_COOLDOWN_MS = 70;
const MIN_SOUND_SPEED = 72;   // px/s of normal impact
const SWEEP_MS = 900;
const HOP_SPEED = 520;                     // px/s
const INTRO_NOTES = NOTES.slice(3, 11);    // E3 .. A4

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const menu = $('menu');
const stats = $('stats');
const deleteButton = $('delete');
const confirmClear = $('confirm-clear');

const game = {
    phase: 'title', // title, play
    paused: false,
    introStart: 0,
    isPlaying: () => game.phase === 'play',
    start() {
        if (game.phase !== 'title') return;
        game.phase = 'play';
        game.introStart = performance.now();
        document.body.dataset.phase = 'play';
    },
};

// Every command, shared by the keyboard (input.js) and the menu buttons.
const actions = {
    undo: () => undo() && select(),
    redo: () => redo() && select(),
    delete: () => deleteSelection() || actions.clearAll(),
    deselect: () => select(),
    clearAll() {
        if (!scene.lines.length && !scene.spawners.length) return;
        menu.hidePopover();
        confirmClear.returnValue = '';
        confirmClear.showModal();
    },
    clearBalls: () => { scene.balls = []; },
    pause() {
        game.paused = !game.paused;
        $('paused').hidden = !game.paused;
        toggled('pause', game.paused);
    },
    stats() {
        stats.hidden = !stats.hidden;
        toggled('stats', !stats.hidden);
    },
    menu: () => menu.togglePopover(),
    sound: () => $('sound').togglePopover(),
    // S switches the mood: the next scale, its name fading in, and a short rising
    // phrase in it. Every line keeps its length and plays the new scale.
    scale() {
        setScale((music.scale + 1) % SCALES.length);
        sound.refresh();
        save();
        const name = $('scale-name');
        name.textContent = SCALES[music.scale][0];
        name.getAnimations().forEach((a) => a.cancel());
        name.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], 1600);
        const octave = SCALES[music.scale][1].length;
        [0, 2, 4, octave].forEach((i, n) => setTimeout(() => play(NOTES[i + octave], 900), n * 110));
    },
    async share() {
        const url = location.href;
        if (navigator.share && matchMedia('(pointer: coarse)').matches) return navigator.share({ title: document.title, url }).catch(() => {});
        await navigator.clipboard.writeText(url);
        const label = menu.querySelector('[data-action="share"] .label');
        label.textContent = 'Link copied';
        setTimeout(() => { label.textContent = 'Copy share link'; }, 1600);
    },
};
game.actions = actions;

const toggled = (action, on) => menu.querySelector(`[data-action="${action}"]`).setAttribute('aria-pressed', on);

if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
    for (const el of document.querySelectorAll('[data-mod]')) el.title = el.title.replace('Cmd', 'Ctrl');
}

render.init(canvas);
const shared = load();
const sound = initSound($('sound'));
initInput(canvas, game);
deleteButton.addEventListener('click', deleteSelection);
confirmClear.addEventListener('close', () => {
    if (confirmClear.returnValue === 'clear') edit(clearAll);
});
menu.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action) actions[action]();
});

// Title: "BOUNCE BEATS" in frozen balls. On start, a wave sweeps left to right:
// each ball hops and falls away while the title plays a rising arpeggio.
// Balls in the same column move together, so the two rows never cross.
// A shared link skips it and opens straight on the scene.
const title = { waiting: [], x0: 0, x1: 0, notesPlayed: shared ? INTRO_NOTES.length : 0 };
if (!shared) {
    const { w, h } = world;
    const { balls, radius } = titleBalls('BOUNCE\nBEATS', w / 2, h / 2 - 40, w);
    title.waiting = balls.map((p) => Object.assign(addBall(p.x, p.y, radius), { frozen: true }));
    title.x0 = Math.min(...balls.map((p) => p.x));
    title.x1 = Math.max(...balls.map((p) => p.x));
}

function introTick(t) {
    const swept = title.x0 + (title.x1 - title.x0) * (t / SWEEP_MS);
    title.waiting = title.waiting.filter((b) => {
        if (b.x > swept) return true;
        b.frozen = false;
        b.vy = -HOP_SPEED;
        return false;
    });
    const last = INTRO_NOTES.length - 1;
    while (title.notesPlayed <= last && t >= (title.notesPlayed / last) * SWEEP_MS) {
        const k = title.notesPlayed / last;
        play(INTRO_NOTES[title.notesPlayed++], 900, (k * 2 - 1) * 0.8);
    }
}

function onHit(ball, line, speed) {
    const now = performance.now();
    if (speed < MIN_SOUND_SPEED || now - (ball.hits.get(line) ?? -Infinity) < HIT_COOLDOWN_MS) return;
    ball.hits.set(line, now);
    const pan = (ball.x / world.w) * 2 - 1;

    const note = noteFor(Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
    play(note, speed, pan);
    sound.pulse(note, Math.min(speed / 1200, 1));
    line.glow = Math.min((line.glow ?? 0) + speed / 1200, 1);
    line.hue = render.hueFor(note);
    render.flash(ball.x, ball.y, Math.min(speed / 1920, 1));
}

function tick(now, dt) {
    if (title.waiting.length || title.notesPlayed < INTRO_NOTES.length) introTick(now - game.introStart);
    for (const s of scene.spawners) {
        if (now - s.last > s.interval) {
            addBall(s.x, s.y);
            s.last = now;
        }
    }
    step(dt, scene.balls, scene.lines, onHit);
    // Drop balls once they're well below the bottom of the screen.
    const floor = render.toWorld(0, render.view.h + 200)[1];
    scene.balls = scene.balls.filter((b) => b.y < floor);
}

// ---- HTML overlay, written only when something changed ----

const px = (x, y, dy) => `${Math.round(x)}px ${Math.round(y + dy)}px`;

let shownCursor, shownDelete, shownEmpty, fps = 0, frames = 0, fpsFrom = 0;

function syncOverlay(now) {
    const c = cursor();
    if (c !== shownCursor) canvas.style.cursor = shownCursor = c;

    const empty = !scene.lines.length && !scene.spawners.length;
    if (empty !== shownEmpty) document.body.toggleAttribute('data-empty', (shownEmpty = empty));

    const anchor = ui.selection.anchor;
    const box = selectionBox();
    const at = !game.isPlaying() || ui.gesture ? null
        : anchor ? px(...render.toScreen(anchor.x, anchor.y), -16)
        : box ? px(...render.toScreen((box.minX + box.maxX) / 2, box.minY), -32)
        : null;
    if (at !== shownDelete) {
        shownDelete = at;
        deleteButton.hidden = !at;
        if (at) deleteButton.style.translate = at;
    }

    frames++;
    if (now - fpsFrom >= 500) {
        fps = Math.round((frames * 1000) / (now - fpsFrom));
        frames = 0;
        fpsFrom = now;
        if (!stats.hidden) {
            $('stat-lines').value = scene.lines.length;
            $('stat-balls').value = scene.balls.length;
            $('stat-spawners').value = scene.spawners.length;
            $('stat-fps').value = fps;
        }
    }
}

let last = performance.now();
requestAnimationFrame(function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (game.phase !== 'title' && !game.paused) tick(now, dt);
    render.draw(now);
    syncOverlay(now);
    requestAnimationFrame(frame);
});
