import * as S from './scene.js';
import { unlock, play, noteFor, lengthFor } from './audio.js';
import { toWorld, camera } from './render.js';

const DRAG_THRESHOLD = 10;
export const HOLD_MS = 500;
const HANDLE_RADIUS = 10;
export const GRID = 20;              // world px; hold Alt to place freely
const STAMP_ANGLE = Math.PI / 12;    // a placed note line slopes gently down to the right

export const ui = {
    pointer: { x: -1, y: -1 },
    hover: { line: null, spawner: null, endpoint: null, handle: null },
    // `anchor` is set when a single line was clicked: it gets the inline delete button.
    selection: { lines: [], spawners: [], anchor: null },
    // pending | draw | stamp | endpoint | line | spawner | move | resize | area
    gesture: null,
    snap: true,     // false while Alt is held
    brush: null,    // a note: tapping the canvas places a line that plays it
};

// ---- snapping ----

const grid = (v) => Math.round(v / GRID) * GRID;

// From a fixed end (ax, ay) toward (x, y): any angle, length snapped to the exact
// length of the nearest note.
function snapEnd(ax, ay, x, y) {
    const length = Math.hypot(x - ax, y - ay);
    if (!ui.snap || length < 1) return [x, y];
    const k = lengthFor(noteFor(length)) / length;
    return [ax + (x - ax) * k, ay + (y - ay) * k];
}

const place = (x, y) => (ui.snap ? [grid(x), grid(y)] : [x, y]);

// Offset that moves point (x, y) by (dx, dy) and lands it on the grid.
const snapOffset = (x, y, dx, dy) => (ui.snap ? [grid(x + dx) - x, grid(y + dy) - y] : [dx, dy]);

export const selectionBox = () => (ui.selection.anchor ? null : S.bounds(ui.selection));

export function select(lines = [], spawners = [], anchor = null) {
    ui.selection = { lines, spawners, anchor };
}

export function deleteSelection() {
    const { lines, spawners } = ui.selection;
    if (!lines.length && !spawners.length) return false;
    S.edit(() => S.remove(ui.selection));
    select();
    return true;
}

export function cursor() {
    const { hover, gesture, pointer } = ui;
    if (gesture?.kind === 'resize') return `${gesture.dir}-resize`;
    if (gesture && gesture.kind !== 'pending' && gesture.kind !== 'draw' && gesture.kind !== 'area') return 'grabbing';
    if (hover.handle) return `${hover.handle.dir}-resize`;
    if (hover.endpoint || hover.line) return 'grab';
    if (hover.spawner) return 'grab';
    const box = selectionBox();
    if (box && inBox(box, pointer.x, pointer.y)) return 'grab';
    return 'crosshair';
}

// Pointer distances are felt on screen: convert a screen distance to world units.
const screen = (n) => n / camera.s;

// The Delete button sits just above a selected spawner's ring.
const spawnerAnchor = (s) => ({ x: s.x, y: s.y - screen(18) });

const inBox = (b, x, y) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;

function refreshHover(x, y) {
    const box = selectionBox();
    ui.hover = {
        handle: (box && S.handles(box).find((h) => Math.hypot(h.x - x, h.y - y) < screen(HANDLE_RADIUS))) || null,
        endpoint: S.endpointAt(x, y, screen(30)),
        line: S.lineAt(x, y, screen(25)),
        spawner: S.spawnerAt(x, y, screen(35)),
    };
}

export function initInput(canvas, game) {
    canvas.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary || e.button > 0) return;
        canvas.setPointerCapture(e.pointerId);
        unlock();
        if (!game.isPlaying()) return game.start();

        const [x, y] = toWorld(e.offsetX, e.offsetY);
        ui.snap = !e.altKey;
        // Hover is recomputed at the press point, so touch (which has no hover) works too.
        refreshHover(x, y);
        ui.gesture = pick(x, y, e.shiftKey);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!e.isPrimary) return;
        const [x, y] = toWorld(e.offsetX, e.offsetY);
        ui.pointer = { x, y };
        ui.snap = !e.altKey;
        if (ui.gesture) drag(ui.gesture, x, y);
        else if (game.isPlaying()) refreshHover(x, y);
    });

    canvas.addEventListener('pointerup', (e) => e.isPrimary && release(...toWorld(e.offsetX, e.offsetY)));
    canvas.addEventListener('pointercancel', () => {
        ui.gesture = null;
        S.commit();
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const spawner = S.spawnerAt(...toWorld(e.offsetX, e.offsetY), screen(50));
        if (!spawner) return;
        S.edit(() => {
            spawner.interval = Math.max(100, Math.min(5000, spawner.interval + Math.sign(e.deltaY) * 50));
        }, spawner);
    }, { passive: false });

    addEventListener('keydown', (e) => {
        // Inside a dialog or the music panel, keys belong to its controls.
        if (e.target instanceof Element && e.target.closest('dialog, #mixer')) return;
        const key = e.key.toLowerCase();
        const action = e.ctrlKey || e.metaKey
            ? { z: e.shiftKey ? 'redo' : 'undo', y: 'redo' }[key]
            : !e.altKey && !e.repeat && KEYS[key];
        if (!action || !game.isPlaying()) return;
        // Let Escape also close the menu natively.
        if (action !== 'deselect') e.preventDefault();
        game.actions[action]();
    });
}

const KEYS = {
    delete: 'delete', backspace: 'delete', escape: 'deselect',
    c: 'clearAll', x: 'clearBalls', ' ': 'pause', h: 'menu', m: 'menu', t: 'stats', e: 'mixer', n: 'notes',
};

// Decides what a press does, by priority.
function pick(x, y, shift) {
    const { hover } = ui;
    const at = { lastX: x, lastY: y, x0: x, y0: y };

    if (shift) {
        select();
        return { kind: 'area', x1: x, y1: y, x2: x, y2: y };
    }
    if (hover.spawner) {
        // Press selects (Delete button appears); dragging moves it.
        select([], [hover.spawner], spawnerAnchor(hover.spawner));
        S.begin();
        return { kind: 'spawner', spawner: hover.spawner, from: { ...hover.spawner }, ...at };
    }
    const box = selectionBox();
    if (hover.handle) {
        S.begin();
        return { kind: 'resize', dir: hover.handle.dir, box, ...at };
    }
    if (box && inBox(box, x, y)) {
        S.begin();
        return { kind: 'move', moved: [0, 0], ...at };
    }
    if (hover.endpoint) {
        S.begin();
        return { kind: 'endpoint', ...hover.endpoint, ...at };
    }
    if (hover.line) {
        select([hover.line], [], { x, y });
        S.begin();
        return { kind: 'line', line: hover.line, from: { ...hover.line }, ...at };
    }
    select();
    if (ui.brush) {
        const [px, py] = place(x, y);
        return { kind: 'stamp', x: px, y: py, ...at, ...stampEnd(px, py, STAMP_ANGLE) };
    }
    return { kind: 'pending', x, y, t0: performance.now(), ...at };
}

// Where a tap at (x, y) would place the armed note's line.
export function brushLine(x, y) {
    const [px, py] = place(x, y);
    return stampEnd(px, py, STAMP_ANGLE);
}

// The far end of a brush line from (x, y): fixed length for the note, any angle.
const stampEnd = (x, y, angle) => {
    const length = lengthFor(ui.brush);
    return { x1: x, y1: y, x2: x + Math.cos(angle) * length, y2: y + Math.sin(angle) * length };
};

function drag(g, x, y) {
    const dx = x - g.x0, dy = y - g.y0;  // total movement since the press
    switch (g.kind) {
        case 'pending':
            if (Math.hypot(dx, dy) > screen(DRAG_THRESHOLD)) {
                const [x1, y1] = place(g.x, g.y);
                Object.assign(g, { kind: 'draw', x1, y1 });
                [g.x2, g.y2] = snapEnd(x1, y1, x, y);
            }
            break;
        case 'draw':
            [g.x2, g.y2] = snapEnd(g.x1, g.y1, x, y);
            break;
        case 'stamp':
            // Dragging aims the line; its length stays locked to the note.
            if (Math.hypot(dx, dy) > screen(DRAG_THRESHOLD)) Object.assign(g, stampEnd(g.x, g.y, Math.atan2(dy, dx)));
            break;
        case 'area':
            [g.x2, g.y2] = [x, y];
            break;
        case 'endpoint': {
            const other = g.end === 1 ? 2 : 1;
            [g.line[`x${g.end}`], g.line[`y${g.end}`]] = snapEnd(g.line[`x${other}`], g.line[`y${other}`], x, y);
            break;
        }
        case 'line': {
            const [ox, oy] = snapOffset(g.from.x1, g.from.y1, dx, dy);
            Object.assign(g.line, { x1: g.from.x1 + ox, y1: g.from.y1 + oy, x2: g.from.x2 + ox, y2: g.from.y2 + oy });
            ui.selection.anchor = { x, y };
            break;
        }
        case 'spawner': {
            const [ox, oy] = snapOffset(g.from.x, g.from.y, dx, dy);
            Object.assign(g.spawner, { x: g.from.x + ox, y: g.from.y + oy });
            ui.selection.anchor = spawnerAnchor(g.spawner);
            break;
        }
        case 'move': {
            // Whole grid steps, so a selection keeps its alignment.
            const target = ui.snap ? [grid(dx), grid(dy)] : [dx, dy];
            S.translate(ui.selection, target[0] - g.moved[0], target[1] - g.moved[1]);
            g.moved = target;
            break;
        }
        case 'resize': {
            const next = { ...g.box };
            if (g.dir.includes('w')) next.minX += x - g.lastX;
            if (g.dir.includes('e')) next.maxX += x - g.lastX;
            if (g.dir.includes('n')) next.minY += y - g.lastY;
            if (g.dir.includes('s')) next.maxY += y - g.lastY;
            if (next.maxX - next.minX < 50 || next.maxY - next.minY < 50) return;
            S.scale(ui.selection, g.box, next);
            Object.assign(g, { box: next, lastX: x, lastY: y });
            break;
        }
    }
}

function release(x, y) {
    const g = ui.gesture;
    if (g) drag(g, x, y);
    ui.gesture = null;
    if (!g) return;

    switch (g.kind) {
        case 'pending':
            if (performance.now() - g.t0 >= HOLD_MS) {
                S.edit(() => S.addSpawner(...place(g.x, g.y)));
                navigator.vibrate?.(12);
            } else {
                S.addBall(g.x, g.y);
            }
            break;
        case 'draw':
            S.edit(() => S.addLine(g.x1, g.y1, g.x2, g.y2));
            break;
        case 'stamp':
            S.edit(() => S.addLine(g.x1, g.y1, g.x2, g.y2));
            play(ui.brush, 900);
            break;
        case 'area': {
            const x1 = Math.min(g.x1, x), x2 = Math.max(g.x1, x);
            const y1 = Math.min(g.y1, y), y2 = Math.max(g.y1, y);
            const { lines, spawners } = S.within(x1, y1, x2, y2);
            select(lines, spawners);
            break;
        }
        default:
            S.commit();
    }
    refreshHover(x, y);
}
