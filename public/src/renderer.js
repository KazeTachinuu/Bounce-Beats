/**
 * Renderer - Canvas drawing and visual effects
 */
import { getNoteFromLength } from './constants.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true  // Hint to browser for better performance
        });
        this.impactFlashes = [];

        this.resize();
        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
    }

    resetTextStyle() {
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
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
        const btnWidth = 100;  // Larger for touch
        const btnHeight = 40;  // Larger for touch
        const btnX = x - btnWidth / 2;
        const btnY = y - 50;

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
        this.ctx.font = 'bold 16px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Delete', x, y - 30);
        this.resetTextStyle();

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
        this.drawLineInfo(line, mouseX + 15, mouseY - 10);
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

    drawSpawner(spawner, isHovered = false, timestamp = performance.now()) {
        const pulse = Math.sin(timestamp / 300) * 0.2 + 0.8;
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
            this.resetTextStyle();
        }
    }

    drawLineInfo(line, x, y) {
        if (!line) return;

        // Calculate line length and note
        const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
        const note = getNoteFromLength(length);

        // Draw info at specified position
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(`${Math.round(length)}px → ${note}`, x, y);
    }

    drawHelp(alpha = 1) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Panel dimensions - Apple-style centered modal
        const panelWidth = 600;
        const panelHeight = 440;
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;
        const contentPadding = 48;

        // Outer shadow (depth)
        this.ctx.shadowColor = `rgba(0, 0, 0, ${alpha * 0.5})`;
        this.ctx.shadowBlur = 50;
        this.ctx.shadowOffsetY = 20;

        // Main panel background (dark with slight transparency)
        this.ctx.fillStyle = `rgba(18, 18, 18, ${alpha * 0.96})`;
        this.ctx.beginPath();
        this.ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.ctx.fill();

        // Clear shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetY = 0;

        // Subtle border
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.15})`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.ctx.stroke();

        // Header section
        const headerY = panelY + contentPadding;

        // Title
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        this.ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
        this.resetTextStyle();
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('Keyboard Shortcuts', panelX + contentPadding, headerY);

        // Subtitle
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
        this.ctx.font = '400 15px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillText('Create music by drawing lines and bouncing balls', panelX + contentPadding, headerY + 38);

        // Divider line
        const dividerY = headerY + 72;
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.12})`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(panelX + contentPadding, dividerY);
        this.ctx.lineTo(panelX + panelWidth - contentPadding, dividerY);
        this.ctx.stroke();

        // Helper to draw keyboard key (dark theme)
        const drawKey = (text, x, y) => {
            const keyPadding = 12;
            const keyHeight = 32;
            this.ctx.font = '500 13px -apple-system, "SF Mono", monospace';
            const metrics = this.ctx.measureText(text);
            const keyWidth = Math.max(metrics.width + keyPadding * 2, 44);
            const radius = 6;

            // Key background (subtle gray on dark)
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.08})`;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, keyWidth, keyHeight, radius);
            this.ctx.fill();

            // Key border
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.2})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, keyWidth, keyHeight, radius);
            this.ctx.stroke();

            // Key text
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            this.ctx.font = '500 13px -apple-system, "SF Mono", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, x + keyWidth / 2, y + keyHeight / 2);

            return keyWidth;
        };

        // Helper to draw shortcut row
        const drawShortcut = (keys, description, x, y) => {
            let currentX = x;

            // Draw keys with "or" separator
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach((key, i) => {
                const keyWidth = drawKey(key, currentX, y);
                currentX += keyWidth + 8;

                if (i < keyArray.length - 1) {
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
                    this.ctx.font = '400 13px -apple-system, sans-serif';
                    this.resetTextStyle();
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('or', currentX, y + 16);
                    currentX += 26;
                }
            });

            // Description
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
            this.ctx.font = '400 15px -apple-system, sans-serif';
            this.resetTextStyle();
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(description, currentX + 8, y + 16);
        };

        // Content sections with grid layout
        const contentY = dividerY + 32;
        const col1X = panelX + contentPadding;
        const col2X = panelX + panelWidth / 2 + 8;
        const rowHeight = 48;

        // Left column - Drawing
        let y = contentY;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;
        this.ctx.font = '600 12px -apple-system, sans-serif';
        this.resetTextStyle();
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('DRAWING', col1X, y);
        y += 28;

        drawShortcut('Click', 'Spawn ball', col1X, y);
        y += rowHeight;
        drawShortcut('Drag', 'Draw line', col1X, y);
        y += rowHeight;
        drawShortcut('Hold', 'Spray / spawner', col1X, y);

        // Right column - Controls
        y = contentY;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;
        this.ctx.font = '600 12px -apple-system, sans-serif';
        this.ctx.fillText('CONTROLS', col2X, y);
        y += 28;

        drawShortcut('Space', 'Pause', col2X, y);
        y += rowHeight;
        drawShortcut([['Del', 'C']], 'Clear all', col2X, y);
        y += rowHeight;
        drawShortcut('X', 'Clear balls', col2X, y);
        y += rowHeight;
        drawShortcut([['H', 'T']], 'Help / Stats', col2X, y);

        // Footer
        const footerY = panelY + panelHeight - contentPadding + 8;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.35})`;
        this.ctx.font = '400 13px -apple-system, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText('Press H to close', centerX, footerY);

        // Reset
        this.resetTextStyle();
    }

    drawStats(ballCount, lineCount, spawnerCount, fps) {
        const padding = 16;
        const x = window.innerWidth - padding;
        const y = padding;

        // Minimal design
        const panelWidth = 110;
        const panelHeight = 90;
        const panelX = x - panelWidth;

        // Clean background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(panelX, y, panelWidth, panelHeight);

        // Subtle border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(panelX, y, panelWidth, panelHeight);

        // Draw help icon button (bottom-left of stats panel)
        const iconSize = 24;
        const iconPadding = 10;
        const helpIconX = panelX + iconPadding;
        const helpIconY = y + panelHeight + iconPadding;

        this.drawHelpIcon(helpIconX, helpIconY, iconSize);

        // Return bounds for click detection
        this.helpIconBounds = {
            x: helpIconX,
            y: helpIconY,
            width: iconSize,
            height: iconSize
        };

        // Clean typography
        this.ctx.font = '12px monospace';
        this.resetTextStyle();

        const leftX = panelX + 12;
        const rightX = x - 12;
        let currentY = y + 22;

        // Lines
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillText('Lines', leftX, currentY);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(lineCount.toString(), rightX, currentY);

        currentY += 20;

        // Balls
        this.resetTextStyle();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillText('Balls', leftX, currentY);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(ballCount.toString(), rightX, currentY);

        currentY += 20;

        // Spawners
        this.resetTextStyle();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillText('Spawn', leftX, currentY);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(spawnerCount.toString(), rightX, currentY);

        currentY += 20;

        // FPS
        this.resetTextStyle();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillText('FPS', leftX, currentY);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(fps > 0 ? fps.toString() : '--', rightX, currentY);

        // Reset
        this.resetTextStyle();
    }

    drawPauseOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', window.innerWidth / 2, window.innerHeight / 2);
        this.resetTextStyle();
    }

    drawBall(ball) {
        const pos = ball.getPosition();
        const trail = ball.getTrail();
        const trailLength = trail.length;

        // Draw trail (batch beginPath calls)
        for (let i = 0; i < trailLength; i++) {
            const progress = i / trailLength;
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

    drawHelpIcon(x, y, size) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size / 2;

        // Outer glow for visibility
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
        this.ctx.shadowBlur = 8;

        // Background circle with gradient
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(40, 40, 40, 0.95)');
        gradient.addColorStop(1, 'rgba(20, 20, 20, 0.95)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Reset shadow
        this.ctx.shadowBlur = 0;

        // Border with subtle highlight
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
        this.ctx.stroke();

        // Question mark with better font
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('?', centerX, centerY + 1);

        // Reset
        this.resetTextStyle();
    }

    getHelpIconBounds() {
        return this.helpIconBounds || null;
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
