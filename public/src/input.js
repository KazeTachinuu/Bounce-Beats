import * as S from './scene.js';
import { unlock } from './audio.js';
import { toWorld, camera } from './render.js';

const DRAG_THRESHOLD = 10;
export const HOLD_MS = 500;
const HANDLE_RADIUS = 10;

export const ui = {
    pointer: { x: -1, y: -1 },
    hover: { line: null, spawner: null, endpoint: null, handle: null },
    // `anchor` is set when a single line was clicked: it gets the inline delete button.
    selection: { lines: [], spawners: [], anchor: null },
    // pending | draw | endpoint | line | move | resize | area
    gesture: null,
};

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
        // Hover is recomputed at the press point, so touch (which has no hover) works too.
        refreshHover(x, y);
        ui.gesture = pick(x, y, e.shiftKey);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!e.isPrimary) return;
        const [x, y] = toWorld(e.offsetX, e.offsetY);
        const dx = x - ui.pointer.x, dy = y - ui.pointer.y;
        ui.pointer = { x, y };
        if (ui.gesture) drag(ui.gesture, x, y, dx, dy);
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
    c: 'clearAll', x: 'clearBalls', ' ': 'pause', h: 'menu', m: 'menu', t: 'stats', e: 'mixer',
};

// Decides what a press does, by priority.
function pick(x, y, shift) {
    const { hover } = ui;
    const at = { lastX: x, lastY: y };

    if (shift) {
        select();
        return { kind: 'area', x1: x, y1: y, x2: x, y2: y };
    }
    if (hover.spawner) {
        // Press selects (Delete button appears); dragging moves it.
        select([], [hover.spawner], spawnerAnchor(hover.spawner));
        S.begin();
        return { kind: 'spawner', spawner: hover.spawner };
    }
    const box = selectionBox();
    if (hover.handle) {
        S.begin();
        return { kind: 'resize', dir: hover.handle.dir, box, ...at };
    }
    if (box && inBox(box, x, y)) {
        S.begin();
        return { kind: 'move', ...at };
    }
    if (hover.endpoint) {
        S.begin();
        return { kind: 'endpoint', ...hover.endpoint };
    }
    if (hover.line) {
        select([hover.line], [], { x, y });
        S.begin();
        return { kind: 'line', line: hover.line, ...at };
    }
    select();
    return { kind: 'pending', x, y, t0: performance.now() };
}

function drag(g, x, y, dx, dy) {
    switch (g.kind) {
        case 'pending':
            if (Math.hypot(x - g.x, y - g.y) > screen(DRAG_THRESHOLD)) Object.assign(g, { kind: 'draw', x1: g.x, y1: g.y, x2: x, y2: y });
            break;
        case 'draw':
        case 'area':
            [g.x2, g.y2] = [x, y];
            break;
        case 'endpoint':
            [g.line[`x${g.end}`], g.line[`y${g.end}`]] = [x, y];
            break;
        case 'line':
            S.translate({ lines: [g.line], spawners: [] }, dx, dy);
            ui.selection.anchor = { x, y };
            break;
        case 'spawner':
            S.translate({ lines: [], spawners: [g.spawner] }, dx, dy);
            ui.selection.anchor = spawnerAnchor(g.spawner);
            break;
        case 'move':
            S.translate(ui.selection, dx, dy);
            break;
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
    ui.gesture = null;
    if (!g) return;

    switch (g.kind) {
        case 'pending':
            if (performance.now() - g.t0 >= HOLD_MS) {
                S.edit(() => S.addSpawner(g.x, g.y));
                navigator.vibrate?.(12);
            } else {
                S.addBall(g.x, g.y);
            }
            break;
        case 'draw':
            S.edit(() => S.addLine(g.x1, g.y1, x, y));
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
