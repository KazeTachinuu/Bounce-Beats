import { BALL_RADIUS, distToSegment } from './physics.js';

export const DEFAULT_INTERVAL = 1500;
const MIN_LINE_LENGTH = 50;
const SPAWNER_PADDING = 20;
const BOX_PADDING = 20;

export const scene = { lines: [], spawners: [], balls: [] };

// The coordinate space lines live in. It follows the screen while you draw; a shared
// scene keeps the size it was made at (`fixed`) and the view is scaled to fit it.
export const world = { w: innerWidth, h: innerHeight, fixed: false };

// ---- entities ----

export function addLine(x1, y1, x2, y2) {
    if (Math.hypot(x2 - x1, y2 - y1) >= MIN_LINE_LENGTH) scene.lines.push({ x1, y1, x2, y2 });
}

export function addSpawner(x, y, interval = DEFAULT_INTERVAL) {
    scene.spawners.push({ x, y, interval, last: 0 });
}

export function addBall(x, y, r = BALL_RADIUS) {
    makeRoom(scene.balls);
    const ball = { x, y, vx: 0, vy: 0, r, frozen: false, hits: new Map() };
    scene.balls.push(ball);
    return ball;
}

// Bounces are perfectly elastic, so a ball caught between lines never leaves.
// Past the cap the oldest ball goes, so every new ball still plays.
const MAX_BALLS = 300;

function makeRoom(balls) {
    if (balls.length >= MAX_BALLS) balls.shift();
}

export function remove({ lines, spawners }) {
    scene.lines = scene.lines.filter((l) => !lines.includes(l));
    scene.spawners = scene.spawners.filter((s) => !spawners.includes(s));
}

export function clearAll() {
    scene.lines = [];
    scene.spawners = [];
}

// ---- undo / redo ----
// Edits are recorded as JSON snapshots of lines + spawners (balls are transient).
// Snapshots never hold object references, so undo can't desync from the scene.

const past = [];
const future = [];
let pending = null;
let lastMerge = { key: null, time: 0 };

const state = () => [
    scene.lines.map(({ x1, y1, x2, y2 }) => [x1, y1, x2, y2].map(Math.round)),
    scene.spawners.map(({ x, y, interval }) => [Math.round(x), Math.round(y), interval]),
];
const snapshot = () => JSON.stringify(state());

function apply([lines, spawners]) {
    scene.lines = lines.map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2 }));
    scene.spawners = [];
    for (const [x, y, interval] of spawners) addSpawner(x, y, interval);
}

function restore(json) {
    apply(JSON.parse(json));
    save();
}

// ---- share link ----
// The scene lives in the URL hash: reloading keeps it, and the link shares it.
// Encoding is a bitstream, base64url'd once at the end:
// - positions on a 2px grid, lines sorted left to right and stored left to right
//   (order and direction don't matter to the game), so the numbers stay small;
// - every number is a delta from the previous point, written as an Exp-Golomb code
//   (the self-delimiting integer code H.264 uses): small values take few bits;
// - the encoder tries every code order k and keeps the shortest result.
// Layout: k(4 bits) worldW worldH lineCount spawnerCount, lines, spawners.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const GRID = 2;            // px
const TEMPO_STEP = 50;     // ms, the scroll-wheel step

function bitWriter() {
    const bits = [];
    const raw = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
    const ue = (v, k) => {
        const x = (v >> k) + 1, n = 31 - Math.clz32(x);
        raw(0, n);
        raw(x, n + 1);
        raw(v & ((1 << k) - 1), k);
    };
    const se = (v, k) => ue(v <= 0 ? -2 * v : 2 * v - 1, k);
    const text = () => {
        let out = '';
        for (let i = 0; i < bits.length; i += 6) {
            let c = 0;
            for (let j = 0; j < 6; j++) c = c * 2 + (bits[i + j] ?? 0);
            out += B64[c];
        }
        return out;
    };
    return { raw, ue, se, text, size: () => bits.length };
}

function bitReader(code) {
    let pos = 0;
    const bit = () => {
        const c = B64.indexOf(code[pos / 6 | 0]);
        if (c < 0) throw new Error('Bad scene link');
        return (c >> (5 - pos++ % 6)) & 1;
    };
    const raw = (n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + bit(); return v; };
    const ue = (k) => {
        let n = 0;
        while (!bit()) if (++n > 24) throw new Error('Bad scene link');
        return ((((1 << n) | raw(n)) - 1) << k) | raw(k);
    };
    const se = (k) => { const u = ue(k); return u & 1 ? (u + 1) / 2 : -u / 2; };
    return { raw, ue, se };
}

function encodeWith(k, [w, h], lines, spawners) {
    const out = bitWriter();
    out.raw(k, 4);
    out.ue(w, 6); out.ue(h, 6);
    out.ue(lines.length, 0); out.ue(spawners.length, 0);
    let px = 0, py = 0;
    for (const [x1, y1, x2, y2] of lines) {
        out.se(x1 - px, k); out.se(y1 - py, k); out.ue(x2 - x1, k); out.se(y2 - y1, k);
        [px, py] = [x1, y1];
    }
    px = py = 0;
    for (const [x, y, tempo] of spawners) {
        out.se(x - px, k); out.se(y - py, k); out.se(tempo - DEFAULT_INTERVAL / TEMPO_STEP, 2);
        [px, py] = [x, y];
    }
    return out;
}

function encode(size, lines, spawners) {
    const byX = (a, b) => a[0] - b[0] || a[1] - b[1];
    lines = lines.map(([x1, y1, x2, y2]) => (x1 <= x2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1])).sort(byX);
    spawners = [...spawners].sort(byX);
    let best = null;
    for (let k = 0; k < 16; k++) {
        const candidate = encodeWith(k, size, lines, spawners);
        if (!best || candidate.size() < best.size()) best = candidate;
    }
    return best.text();
}

function decode(code) {
    const r = bitReader(code);
    const k = r.raw(4);
    const size = [r.ue(6), r.ue(6)];
    const lineCount = r.ue(0), spawnerCount = r.ue(0);
    const lines = [], spawners = [];
    let px = 0, py = 0;
    for (let i = 0; i < lineCount; i++) {
        const x1 = px + r.se(k), y1 = py + r.se(k);
        lines.push([x1, y1, x1 + r.ue(k), y1 + r.se(k)]);
        [px, py] = [x1, y1];
    }
    px = py = 0;
    for (let i = 0; i < spawnerCount; i++) {
        const x = px + r.se(k), y = py + r.se(k);
        spawners.push([x, y, DEFAULT_INTERVAL / TEMPO_STEP + r.se(2)]);
        [px, py] = [x, y];
    }
    return { size, lines, spawners };
}

function save() {
    const [lines, spawners] = state();
    if (!lines.length && !spawners.length) return history.replaceState(null, '', location.pathname);
    const q = (v) => Math.round(v / GRID);
    const code = encode(
        // Rounded down so the same screen reopens at exactly 1:1.
        [Math.floor(world.w / GRID), Math.floor(world.h / GRID)],
        lines.map((l) => l.map(q)),
        spawners.map(([x, y, t]) => [q(x), q(y), Math.round(t / TEMPO_STEP)]),
    );
    history.replaceState(null, '', `#${code}`);
}

// Restores a shared scene in the coordinates it was made in; the renderer scales
// the view to fit this screen.
export function load() {
    try {
        if (location.hash.length < 2) return;
        const { size, lines, spawners } = decode(location.hash.slice(1));
        Object.assign(world, { w: size[0] * GRID, h: size[1] * GRID, fixed: true });
        apply([lines.map((l) => l.map((v) => v * GRID)), spawners.map(([x, y, t]) => [x * GRID, y * GRID, t * TEMPO_STEP])]);
    } catch {
        history.replaceState(null, '', location.pathname);
    }
}

export function begin() {
    pending ??= snapshot();
}

// `mergeKey` folds rapid repeats (e.g. scroll ticks) into a single undo step.
export function commit(mergeKey = null) {
    if (pending === null) return;
    const before = pending;
    pending = null;
    if (before === snapshot()) return;

    const now = performance.now();
    const merge = mergeKey && mergeKey === lastMerge.key && now - lastMerge.time < 800;
    lastMerge = { key: mergeKey, time: now };
    future.length = 0;
    save();
    if (merge) return;
    past.push(before);
    if (past.length > 100) past.shift();
}

export function edit(fn, mergeKey) {
    begin();
    fn();
    commit(mergeKey);
}

export function undo() {
    if (!past.length) return false;
    future.push(snapshot());
    restore(past.pop());
    return true;
}

export function redo() {
    if (!future.length) return false;
    past.push(snapshot());
    restore(future.pop());
    return true;
}

// ---- hit testing ----

function nearest(items, distance, max) {
    let best = null;
    for (const item of items) {
        const d = distance(item);
        if (d < max) [max, best] = [d, item];
    }
    return best;
}

export const lineAt = (x, y, max = 25) => nearest(scene.lines, (l) => distToSegment(x, y, l), max);
export const spawnerAt = (x, y, max = 35) => nearest(scene.spawners, (s) => Math.hypot(s.x - x, s.y - y), max);

export function endpointAt(x, y, max = 30) {
    const ends = scene.lines.flatMap((line) => [{ line, end: 1 }, { line, end: 2 }]);
    return nearest(ends, ({ line, end }) => Math.hypot(line[`x${end}`] - x, line[`y${end}`] - y), max);
}

export function within(x1, y1, x2, y2) {
    const inside = (x, y) => x >= x1 && x <= x2 && y >= y1 && y <= y2;
    return {
        lines: scene.lines.filter((l) => inside((l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2)),
        spawners: scene.spawners.filter((s) => inside(s.x, s.y)),
    };
}

// ---- selection geometry ----

export function bounds({ lines, spawners }) {
    const xs = [], ys = [];
    for (const l of lines) xs.push(l.x1, l.x2), ys.push(l.y1, l.y2);
    for (const s of spawners) xs.push(s.x - SPAWNER_PADDING, s.x + SPAWNER_PADDING), ys.push(s.y - SPAWNER_PADDING, s.y + SPAWNER_PADDING);
    if (!xs.length) return null;
    return {
        minX: Math.min(...xs) - BOX_PADDING, maxX: Math.max(...xs) + BOX_PADDING,
        minY: Math.min(...ys) - BOX_PADDING, maxY: Math.max(...ys) + BOX_PADDING,
    };
}

export function handles({ minX, minY, maxX, maxY }) {
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return [
        ['nw', minX, minY], ['n', cx, minY], ['ne', maxX, minY], ['e', maxX, cy],
        ['se', maxX, maxY], ['s', cx, maxY], ['sw', minX, maxY], ['w', minX, cy],
    ].map(([dir, x, y]) => ({ dir, x, y }));
}

export function translate({ lines, spawners }, dx, dy) {
    for (const l of lines) l.x1 += dx, l.y1 += dy, l.x2 += dx, l.y2 += dy;
    for (const s of spawners) s.x += dx, s.y += dy;
}

// Maps every point from box `from` onto box `to`.
export function scale({ lines, spawners }, from, to) {
    const sx = (to.maxX - to.minX) / (from.maxX - from.minX);
    const sy = (to.maxY - to.minY) / (from.maxY - from.minY);
    const mx = (x) => to.minX + (x - from.minX) * sx;
    const my = (y) => to.minY + (y - from.minY) * sy;
    for (const l of lines) [l.x1, l.y1, l.x2, l.y2] = [mx(l.x1), my(l.y1), mx(l.x2), my(l.y2)];
    for (const s of spawners) [s.x, s.y] = [mx(s.x), my(s.y)];
}
