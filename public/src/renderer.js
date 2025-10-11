/**
 * Renderer - Canvas drawing and visual effects
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.impactFlashes = [];

        this.resize();
        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;
        this.ctx.scale(dpr, dpr);
    }

    clear() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    drawLine(line) {
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(line.x1, line.y1);
        this.ctx.lineTo(line.x2, line.y2);
        this.ctx.stroke();
    }

    drawCurrentLine(line) {
        if (!line) return;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(line.x1, line.y1);
        this.ctx.lineTo(line.x2, line.y2);
        this.ctx.stroke();
    }

    drawBall(ball) {
        const pos = ball.getPosition();
        const trail = ball.getTrail();

        // Draw trail
        for (let i = 0; i < trail.length; i++) {
            const progress = i / trail.length;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.4})`;
            this.ctx.beginPath();
            this.ctx.arc(trail[i].x, trail[i].y, progress * ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw ball
        const gradient = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, ball.radius);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    addImpactFlash(x, y, intensity) {
        this.impactFlashes.push(new ImpactFlash(x, y, intensity));
    }

    updateAndDrawFlashes() {
        for (let i = this.impactFlashes.length - 1; i >= 0; i--) {
            const flash = this.impactFlashes[i];
            flash.update();
            flash.draw(this.ctx);
            if (flash.isDead()) this.impactFlashes.splice(i, 1);
        }
    }

    getHeight() {
        return window.innerHeight;
    }

    destroy() {
        window.removeEventListener('resize', this.resizeHandler);
    }
}

/**
 * Impact Flash - Visual effect on ball collision
 */
class ImpactFlash {
    constructor(x, y, intensity) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.maxRadius = 25 + intensity * 15;
        this.alpha = 0.7;
        this.life = 1;
    }

    update() {
        this.radius += (this.maxRadius - this.radius) * 0.25;
        this.alpha *= 0.88;
        this.life -= 0.06;
    }

    draw(ctx) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    isDead() {
        return this.life <= 0;
    }
}
