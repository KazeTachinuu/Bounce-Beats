// Balls never collide with each other, only with lines, so the whole simulation
// is "circle vs. thick segment": integrate, push out of overlap, reflect.

export const BALL_RADIUS = 8;
const GRAVITY = 2000;        // px/s^2
const MAX_SPEED = 2400;      // px/s, keeps a step (10px) well under the contact distance
const LINE_HALF_WIDTH = 6;
const RESTITUTION = 0.9;     // a little energy is lost per bounce, so balls roll on instead of bouncing in place
const STEP = 1 / 240;
const MAX_STEPS = 8;

let accumulator = 0;

export function step(dt, balls, lines, onHit) {
    accumulator = Math.min(accumulator + dt, STEP * MAX_STEPS);
    while (accumulator >= STEP) {
        accumulator -= STEP;
        for (const ball of balls) {
            if (ball.frozen) continue;
            integrate(ball);
            for (const line of lines) collide(ball, line, onHit);
        }
    }
}

function integrate(b) {
    b.vy += GRAVITY * STEP;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) {
        b.vx *= MAX_SPEED / speed;
        b.vy *= MAX_SPEED / speed;
    }
    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
}

function collide(b, line, onHit) {
    const [cx, cy] = closestPoint(b.x, b.y, line);
    let nx = b.x - cx, ny = b.y - cy;
    const dist = Math.hypot(nx, ny);
    const contact = b.r + LINE_HALF_WIDTH;
    if (dist >= contact || dist === 0) return;

    nx /= dist;
    ny /= dist;
    b.x += nx * (contact - dist);
    b.y += ny * (contact - dist);

    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    b.vx -= (1 + RESTITUTION) * vn * nx;
    b.vy -= (1 + RESTITUTION) * vn * ny;
    // Report the normal impact speed: a ball sliding along a line stays quiet.
    onHit(b, line, -vn);
}

function closestPoint(x, y, { x1, y1, x2, y2 }) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    return [x1 + t * dx, y1 + t * dy];
}

export function distToSegment(x, y, line) {
    const [cx, cy] = closestPoint(x, y, line);
    return Math.hypot(x - cx, y - cy);
}
