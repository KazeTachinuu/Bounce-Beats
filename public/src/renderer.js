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

        // Reset transform before scaling to prevent accumulation
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    clear() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    drawLine(line, isHovered = false, isSelected = false) {
        // Selected state
        if (isSelected) {
            this.ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
            this.ctx.lineWidth = 7;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(line.x1, line.y1);
            this.ctx.lineTo(line.x2, line.y2);
            this.ctx.stroke();

            this.ctx.strokeStyle = '#ff6666';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(line.x1, line.y1);
            this.ctx.lineTo(line.x2, line.y2);
            this.ctx.stroke();
            return;
        }

        // Hover state (soft glow)
        if (isHovered) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.lineWidth = 9;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(line.x1, line.y1);
            this.ctx.lineTo(line.x2, line.y2);
            this.ctx.stroke();
        }

        // Normal state
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(line.x1, line.y1);
        this.ctx.lineTo(line.x2, line.y2);
        this.ctx.stroke();
    }

    drawDeleteButton(x, y, mouseX, mouseY) {
        const btnWidth = 80;
        const btnHeight = 28;
        const btnX = x - btnWidth / 2;
        const btnY = y - 45;

        const isHovered = mouseX >= btnX && mouseX <= btnX + btnWidth &&
                         mouseY >= btnY && mouseY <= btnY + btnHeight;

        // Button background
        this.ctx.fillStyle = isHovered ? 'rgba(255, 60, 60, 0.95)' : 'rgba(255, 80, 80, 0.85)';
        this.ctx.beginPath();
        this.ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 6);
        this.ctx.fill();

        // Button border
        this.ctx.strokeStyle = isHovered ? '#fff' : 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 6);
        this.ctx.stroke();

        // Button text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 13px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Delete', x, y - 31);
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';

        return { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
    }

    drawCurrentLine(line, mouseX, mouseY) {
        if (!line) return;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(line.x1, line.y1);
        this.ctx.lineTo(line.x2, line.y2);
        this.ctx.stroke();

        // Draw length and note preview
        const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
        const notes = ['A1', 'C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
        const noteIndex = Math.floor(Math.min(length / 1200, 1) * (notes.length - 1));
        const note = notes[noteIndex];

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(`${Math.round(length)}px - ${note}`, mouseX + 15, mouseY - 10);
    }

    drawEndpoints(line) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(line.x1, line.y1, 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(line.x2, line.y2, 6, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawSpawner(spawner, isHovered = false) {
        const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.8;
        const scale = isHovered ? 1.15 : 1;

        // Hover glow
        if (isHovered) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            this.ctx.beginPath();
            this.ctx.arc(spawner.x, spawner.y, 28 * scale, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Outer ring
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.7})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(spawner.x, spawner.y, 16 * scale, 0, Math.PI * 2);
        this.ctx.stroke();

        // Center fill
        this.ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.2})`;
        this.ctx.beginPath();
        this.ctx.arc(spawner.x, spawner.y, 12 * scale, 0, Math.PI * 2);
        this.ctx.fill();

        // Center dot
        this.ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        this.ctx.beginPath();
        this.ctx.arc(spawner.x, spawner.y, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Delete hint on hover
        if (isHovered) {
            this.ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
            this.ctx.font = '11px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Click to remove', spawner.x, spawner.y + 30);
            this.ctx.textAlign = 'left';
        }
    }

    drawHelp(alpha = 1) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
        this.ctx.font = '13px monospace';
        this.ctx.textAlign = 'center';

        const centerX = window.innerWidth / 2;
        const y = 30;

        this.ctx.fillText('Drag: draw • Click: ball • Hold: spray/spawner', centerX, y);
        this.ctx.fillText('Click line: select • Delete button: remove • Backspace: undo • Drag endpoints: edit', centerX, y + 20);
        this.ctx.fillText('Space: pause • X: clear balls • C: clear all • H: toggle help', centerX, y + 40);

        this.ctx.textAlign = 'left';
    }

    drawPauseOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', window.innerWidth / 2, window.innerHeight / 2);
        this.ctx.textAlign = 'left';
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
