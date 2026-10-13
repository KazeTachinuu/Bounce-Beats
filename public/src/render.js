import { scene, world, handles, DEFAULT_INTERVAL } from './scene.js';
import { ui, selectionBox, brushLine, HOLD_MS, GRID } from './input.js';
import { noteFor, NOTES } from './audio.js';
import { BALL_RADIUS } from './physics.js';

const TAU = Math.PI * 2;
const TRAIL = 10;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const BLUE = '100 200 255';
const ORANGE = '255 150 100';

export const view = { w: innerWidth, h: innerHeight };   // the screen, CSS px
export const camera = { s: 1, x: 0, y: 0 };                // world -> screen
let ctx, dpr = 1, sprite;
const flashes = [];

export const toWorld = (x, y) => [(x - camera.x) / camera.s, (y - camera.y) / camera.s];
export const toScreen = (x, y) => [x * camera.s + camera.x, y * camera.s + camera.y];
// Sizes of UI marks (strokes, handles, rings) stay constant on screen at any zoom.
const px = (n) => n / camera.s;

// Fits the world on screen, centered; never zooms in past 1:1.
function fit() {
    if (!world.fixed) [world.w, world.h] = [view.w, view.h];
    camera.s = Math.min(1, view.w / world.w, view.h / world.h);
    camera.x = Math.round((view.w - world.w * camera.s) / 2);   // whole pixels keep lines crisp
    camera.y = Math.round((view.h - world.h * camera.s) / 2);
}

export function init(canvas) {
    ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const resize = ({ width, height }) => {
        dpr = devicePixelRatio;
        [view.w, view.h] = [width, height];
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        sprite = ballSprite(BALL_RADIUS * dpr);
        fit();
    };
    resize(canvas.getBoundingClientRect());
    new ResizeObserver(([entry]) => resize(entry.contentRect)).observe(canvas);
}

// Pitch to hue: low notes violet, high notes teal.
export const hueFor = (note) => 275 - (NOTES.indexOf(note) / (NOTES.length - 1)) * 100;

export function flash(x, y, intensity) {
    flashes.push({ x, y, r: 5, max: 25 + intensity * 15, alpha: 0.7, life: 1 });
}

export function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, view.w, view.h);
    fit();
    ctx.setTransform(dpr * camera.s, 0, 0, dpr * camera.s, dpr * camera.x, dpr * camera.y);
    ctx.lineCap = 'round';

    const { selection, hover, gesture, pointer } = ui;
    if (ui.snap && SNAPPING.has(gesture?.kind)) gridDots();
    for (const l of scene.lines) {
        line(l, l === hover.line && !gesture, selection.anchor && selection.lines.includes(l));
    }
    noteNames();

    const box = selectionBox();
    if (gesture?.kind === 'area') area(gesture, now);
    if (box) selectionFrame(box, selection, now);
    if (gesture?.kind === 'draw' || gesture?.kind === 'stamp') preview(gesture, now);
    if (gesture?.kind === 'pending') charge(gesture, now);
    if (ui.brush && !gesture && !hover.line && !hover.spawner && pointer.x >= 0) ghost(pointer);

    flashFrame();
    balls();
    for (const s of scene.spawners) {
        spawner(s, s === hover.spawner && !gesture, selection.anchor && selection.spawners.includes(s), now);
    }

    const dragged = gesture?.line;
    if (dragged) {
        endpoints(dragged);
        lineInfo(dragged, pointer.x, pointer.y);
    } else if (hover.endpoint && !gesture) {
        endpoints(hover.endpoint.line);
    }
}

// ---- lines ----

function stroke({ x1, y1, x2, y2 }, style, width) {
    ctx.strokeStyle = style;
    ctx.lineWidth = px(width);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function line(l, hovered = false, selected = false) {
    if (selected) {
        stroke(l, 'rgb(255 80 80 / .5)', 7);
        return stroke(l, '#f66', 3);
    }
    // A hit leaves a colored glow that fades: the line visibly "rings".
    if (l.glow > 0.01) {
        stroke(l, `hsl(${l.hue} 85% 70% / ${l.glow * 0.55})`, 3 + l.glow * 8);
        l.glow *= 0.9;
    }
    if (hovered) stroke(l, 'rgb(255 255 255 / .2)', 9);
    stroke(l, '#fff', 3);
}

const SNAPPING = new Set(['draw', 'stamp', 'line', 'spawner', 'move']);

// Faint dots on the snap grid, over the visible part of the world.
function gridDots() {
    const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(view.w, view.h);
    if (((x1 - x0) / GRID) * ((y1 - y0) / GRID) > 20000) return;  // too zoomed out to be useful
    const r = px(1);
    ctx.fillStyle = 'rgb(255 255 255 / .12)';
    ctx.beginPath();
    for (let x = Math.ceil(x0 / GRID) * GRID; x <= x1; x += GRID) {
        for (let y = Math.ceil(y0 / GRID) * GRID; y <= y1; y += GRID) {
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
    }
    ctx.fill();
}

// Each line's note in small grey type, just above its middle.
function noteNames() {
    for (const l of scene.lines) {
        const note = noteFor(Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
        onScreen((l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2, (x, y) => {
            ctx.font = `500 10px ${MONO}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = 'rgb(255 255 255 / .4)';
            ctx.fillText(note[0], x, y - 8);
        });
    }
}

// Where the armed note's line would go, following the pointer.
function ghost({ x, y }) {
    stroke(brushLine(x, y), `hsl(${hueFor(ui.brush)} 80% 70% / .35)`, 3);
}

function preview(d, now) {
    const pulse = Math.sin(now / 100) * 0.15 + 0.65;
    const gradient = ctx.createLinearGradient(d.x1, d.y1, d.x2, d.y2);
    gradient.addColorStop(0, `rgb(${BLUE} / ${pulse})`);
    gradient.addColorStop(1, `rgb(150 100 255 / ${pulse})`);
    stroke(d, `rgb(255 255 255 / ${pulse * 0.3})`, 8);
    stroke(d, gradient, 4);
    dots([[d.x1, d.y1], [d.x2, d.y2]], 5, `rgb(${BLUE} / ${pulse})`);
    lineInfo(d, d.x2, d.y2);
}

function endpoints(l) {
    dots([[l.x1, l.y1], [l.x2, l.y2]], 6, 'rgb(255 255 255 / .5)');
}

function dots(points, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    r = px(r);
    for (const [x, y] of points) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
}

// ---- balls ----

function ballSprite(r) {
    const size = Math.ceil(r * 2);
    const canvas = new OffscreenCanvas(size, size);
    const g = canvas.getContext('2d');
    const gradient = g.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(1, 'rgb(255 255 255 / .8)');
    g.fillStyle = gradient;
    g.arc(r, r, r, 0, TAU);
    g.fill();
    return canvas;
}

function balls() {
    // Trails are batched by age: TRAIL fills per frame instead of TRAIL per ball.
    for (const b of scene.balls) {
        b.trail ??= [];
        b.trail.push(b.x, b.y);
        if (b.trail.length > TRAIL * 2) b.trail.splice(0, 2);
    }
    for (let age = 0; age < TRAIL; age++) {
        const p = age / TRAIL;
        ctx.fillStyle = `rgb(255 255 255 / ${p * 0.4})`;
        ctx.beginPath();
        for (const b of scene.balls) {
            const i = age * 2 - (TRAIL * 2 - b.trail.length);
            if (i < 0) continue;
            ctx.moveTo(b.trail[i] + p * b.r, b.trail[i + 1]);
            ctx.arc(b.trail[i], b.trail[i + 1], p * b.r, 0, TAU);
        }
        ctx.fill();
    }
    for (const b of scene.balls) ctx.drawImage(sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
}

function flashFrame() {
    ctx.lineWidth = 2;
    for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.r += (f.max - f.r) * 0.25;
        f.alpha *= 0.88;
        f.life -= 0.06;
        ctx.strokeStyle = `rgb(255 255 255 / ${f.alpha})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, TAU);
        ctx.stroke();
        if (f.life <= 0) flashes.splice(i, 1);
    }
}

// ---- spawners ----

function spawner(s, hovered, selected, now) {
    const pulse = Math.sin(now / (300 * (s.interval / DEFAULT_INTERVAL))) * 0.2 + 0.8;
    const k = px(hovered ? 1.15 : 1);
    const hue = s.interval < 800 ? 0 : s.interval > 2500 ? 220 : 180;
    const ring = s.interval === DEFAULT_INTERVAL ? '255 255 255' : null;

    if (hovered) circle(s.x, s.y, 28 * k, 'rgb(255 255 255 / .15)');
    if (selected) circle(s.x, s.y, 22 * k, 'rgb(255 80 80 / .25)');
    ctx.strokeStyle = selected ? '#f66' : ring ? `rgb(${ring} / ${pulse * 0.7})` : `hsl(${hue} 70% 60% / ${pulse * 0.7})`;
    ctx.lineWidth = px(2);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 16 * k, 0, TAU);
    ctx.stroke();
    circle(s.x, s.y, 12 * k, `rgb(255 255 255 / ${pulse * 0.2})`);
    circle(s.x, s.y, px(3), `rgb(255 255 255 / ${pulse})`);

    if (hovered) {
        const bpm = Math.round(60000 / s.interval);
        label([`${(s.interval / 1000).toFixed(1)}s  ${bpm} BPM`, 'scroll to adjust'], s.x, s.y, 'center', 0, 28);
    }
}

function circle(x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
}

// Ring that fills while the pointer is held still: release when full for a spawner.
function charge(g, now) {
    const t = (now - g.t0 - 120) / (HOLD_MS - 120);
    if (t <= 0) return;
    const done = t >= 1;
    ctx.strokeStyle = done ? '#fff' : 'rgb(255 255 255 / .6)';
    ctx.lineWidth = px(done ? 3 : 2);
    ctx.beginPath();
    ctx.arc(g.x, g.y, px(16), -Math.PI / 2, -Math.PI / 2 + Math.min(t, 1) * TAU);
    ctx.stroke();
}

// ---- selection ----

function dashed(x, y, w, h, color, fillAlpha, now) {
    ctx.fillStyle = `rgb(${color} / ${fillAlpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `rgb(${color} / .85)`;
    ctx.lineWidth = px(2.5);
    ctx.setLineDash([px(8), px(8)]);
    ctx.lineDashOffset = px(-(now / 20) % 16);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
}

function area(g, now) {
    dashed(Math.min(g.x1, g.x2), Math.min(g.y1, g.y2), Math.abs(g.x2 - g.x1), Math.abs(g.y2 - g.y1),
        BLUE, Math.sin(now / 150) * 0.03 + 0.1, now);
}

function selectionFrame(b, { lines, spawners }, now) {
    dashed(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY, ORANGE, Math.sin(now / 150) * 0.02 + 0.06, now);

    const size = px(12);
    ctx.fillStyle = `rgb(${ORANGE})`;
    ctx.strokeStyle = 'rgb(255 255 255 / .9)';
    ctx.lineWidth = px(2);
    for (const { x, y } of handles(b)) {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    }

    onScreen(b.minX, b.minY, (x, y) => {
        const text = `${lines.length + spawners.length} selected`;
        ctx.font = `12px ${MONO}`;
        ctx.fillStyle = `rgb(${ORANGE} / .9)`;
        ctx.fillRect(x, y - 24, ctx.measureText(text).width + 12, 20);
        ctx.fillStyle = '#000';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(text, x + 6, y - 14);
    });
}

// ---- labels ----

function lineInfo(l, x, y) {
    const length = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    const note = noteFor(length);
    label([`${note[0]}  ${Math.round(length)}px`], x, y, 'left', 16, -40, `hsl(${hueFor(note)} 80% 65% / .7)`);
}

// Draws in screen pixels at the screen position of world point (x, y), so text
// stays crisp and readable at any zoom.
function onScreen(x, y, draw) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(...toScreen(x, y));
    ctx.restore();
}

// A dark rounded tag, offset (dx, dy) screen px from a world point, kept on screen.
function label(rows, wx, wy, align, dx, dy, border = 'rgb(255 255 255 / .3)') {
    onScreen(wx, wy, (sx, sy) => tag(rows, sx + dx, sy + dy, align, border));
}

function tag(rows, x, y, align, border) {
    ctx.font = `13px ${MONO}`;
    const pad = 8, lh = 18;
    const w = Math.max(...rows.map((r) => ctx.measureText(r).width)) + pad * 2;
    const h = rows.length * lh + pad;
    let left = align === 'center' ? x - w / 2 : x;
    if (left + w > view.w - 8) left = x - w - 32;
    left = Math.max(8, left);
    const top = Math.max(8, Math.min(y, view.h - h - 8));

    ctx.fillStyle = 'rgb(0 0 0 / .85)';
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    rows.forEach((row, i) => {
        ctx.fillStyle = i ? 'rgb(255 255 255 / .55)' : 'rgb(255 255 255 / .95)';
        ctx.fillText(row, left + pad, top + pad / 2 + lh * (i + 0.5));
    });
}
