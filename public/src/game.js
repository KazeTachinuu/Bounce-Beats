import { PhysicsEngine } from './physics.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './renderer.js';
import { InputController } from './InputController.js';
import { EntityManager } from './EntityManager.js';
import { UIManager } from './UIManager.js';
import { InteractionController } from './InteractionController.js';
import { COLLISION_CONFIG } from './constants.js';

export class Game {
    constructor(canvas) {
        this.physics = new PhysicsEngine();
        this.audio = new AudioEngine();
        this.renderer = new Renderer(canvas);
        this.entities = new EntityManager(this.physics);
        this.ui = new UIManager();
        this.input = new InputController(canvas);
        this.interaction = new InteractionController(this.entities, this.ui, this.audio);

        this.isPaused = false;
        this.isRunning = true;
        this.collisionCooldowns = new Map();
        this.lastCooldownCleanup = 0;
        this.welcomeCollisionCount = 0;
        this.lastWelcomeCollisionReset = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.lastFrameTime = performance.now();

        this.setupCallbacks();
        this.setupCollisions();
        this.animate();
    }

    setupCallbacks() {
        this.input.onMouseDown = (pos) => this.interaction.handleMouseDown(pos);
        this.input.onMouseMove = (pos) => this.interaction.handleMouseMove(pos);
        this.input.onMouseUp = (event) => this.interaction.handleMouseUp(event);
        this.input.onKeyPress = (key, ctrlKey, metaKey, shiftKey) =>
            this.interaction.handleKeyPress(key, ctrlKey, metaKey, shiftKey);
        this.interaction.togglePause = () => this.togglePause();
    }

    setupCollisions() {
        this.physics.onCollision((event) => {
            event.pairs.forEach((pair) => {
                const ballBody = pair.bodyA.circleRadius ? pair.bodyA : pair.bodyB;
                const lineBody = ballBody === pair.bodyA ? pair.bodyB : pair.bodyA;

                if (ballBody.circleRadius && lineBody.isStatic) {
                    this.handleCollision(ballBody, lineBody);
                }
            });
        });
    }

    handleCollision(ballBody, lineBody) {
        const ball = this.entities.getBallAtBody(ballBody);
        const line = this.entities.getLineAtBody(lineBody);
        if (!ball || !line) return;

        const now = this.lastFrameTime;
        const isWelcomeScreen = this.ui.isWelcomeBallsFalling();

        if (isWelcomeScreen) {
            if (now - this.lastWelcomeCollisionReset > 100) {
                this.welcomeCollisionCount = 0;
                this.lastWelcomeCollisionReset = now;
            }
            if (this.welcomeCollisionCount >= 2) return;
            this.welcomeCollisionCount++;
            const speed = ball.getVelocity();
            if (speed > COLLISION_CONFIG.minSpeedForSound) {
                this.audio.playNote(line.length, speed);
            }
            return;
        }

        const key = `${ballBody.id}-${lineBody.id}`;
        const last = this.collisionCooldowns.get(key) || 0;
        if (now - last > COLLISION_CONFIG.cooldownMs) {
            const speed = ball.getVelocity();
            if (speed > COLLISION_CONFIG.minSpeedForSound) {
                this.audio.playNote(line.length, speed);
                const pos = ball.getPosition();
                this.renderer.addImpactFlash(pos.x, pos.y, Math.min(speed / COLLISION_CONFIG.flashIntensityDivisor, 1));
                this.collisionCooldowns.set(key, now);
            }
        }
    }

    update(timestamp, delta) {
        if (this.isPaused) return;
        if (this.ui.isWelcomeShowingTitle()) return;
        this.physics.update(delta);
        this.entities.updateBalls();
        this.entities.updateSpawners(timestamp);
        this.entities.removeOffScreenBalls(this.renderer.getHeight());
        if (!this.ui.isWelcomeBallsFalling()) {
            this.interaction.update(this.input.mouse);
        }
    }

    render() {
        this.renderer.clear();

        if (this.ui.needsWelcomeBalls()) {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2 - 40;
            const positions = this.renderer.generateTextBalls('BOUNCE BEATS', centerX, centerY, 8);
            this.entities.createWelcomeBalls(positions);
            this.entities.createWelcomeLines(window.innerHeight - 80);
            this.ui.markWelcomeBallsCreated();
        }

        if (this.ui.isWelcomeShowingTitle()) {
            this.renderer.drawWelcomeScreen(this.entities.welcomeBalls);
            this.entities.welcomeLines.forEach(line => {
                this.renderer.drawLine(line, false, false);
            });
            return;
        }

        if (this.ui.isWelcomeBallsFalling()) {
            this.entities.updateWelcomeBallsFall();
            this.entities.welcomeBalls.forEach(ball => {
                ball.update();
                this.renderer.drawBall(ball);
            });
            this.entities.welcomeLines.forEach(line => {
                this.renderer.drawLine(line, false, false);
            });
            this.ui.finishWelcome();
            if (!this.ui.isWelcomeActive()) {
                this.entities.clearWelcomeScreen();
                this.entities.balls.push(...this.entities.welcomeBalls);
                this.entities.welcomeBalls = [];
            }
            return;
        }

        this.entities.lines.forEach(line => {
            const isHovered = line === this.ui.hovered.line;
            const isSelected = line === this.ui.selected.line;
            this.renderer.drawLine(line, isHovered, isSelected);
        });

        const drawing = this.interaction.getDrawing();
        if (drawing) this.renderer.drawCurrentLine(drawing, this.input.mouse.x, this.input.mouse.y);

        this.renderer.updateAndDrawFlashes();
        this.entities.balls.forEach(ball => this.renderer.drawBall(ball));

        this.entities.spawners.forEach(spawner => {
            const isHovered = spawner === this.ui.hovered.spawner;
            this.renderer.drawSpawner(spawner, isHovered, this.lastFrameTime);
        });

        const dragging = this.interaction.getDragging();
        const showingHelp = this.ui.shouldShowHelp();
        if (dragging) {
            this.renderer.drawEndpoints(dragging.line);
            if (!showingHelp) {
                this.renderer.drawLineInfo(dragging.line, this.input.mouse.x, this.input.mouse.y);
            }
        } else if (this.ui.hovered.endpoint && !this.ui.selected.line) {
            this.renderer.drawEndpoints(this.ui.hovered.endpoint.line);
        }

        if (this.ui.selected.line) {
            const midX = (this.ui.selected.line.x1 + this.ui.selected.line.x2) / 2;
            const midY = (this.ui.selected.line.y1 + this.ui.selected.line.y2) / 2;
            const bounds = this.renderer.drawDeleteButton(midX, midY, this.input.mouse.x, this.input.mouse.y);
            this.ui.setDeleteButton(bounds);
        } else {
            this.ui.setDeleteButton(null);
        }

        if (this.isPaused) this.renderer.drawPauseOverlay();

        if (this.ui.shouldShowHelp()) {
            this.renderer.drawHelp(this.ui.getHelpAlpha());
            this.entities.lines.forEach(line => {
                const midX = (line.x1 + line.x2) / 2;
                const midY = (line.y1 + line.y2) / 2;
                this.renderer.drawLineInfo(line, midX, midY);
            });
        }

        if (this.ui.shouldShowStats()) {
            this.renderer.drawStats(
                this.entities.balls.length,
                this.entities.lines.length,
                this.entities.spawners.length,
                this.fps
            );
            const helpIconBounds = this.renderer.getHelpIconBounds();
            if (helpIconBounds) this.ui.setHelpIcon(helpIconBounds);
        } else {
            this.ui.setHelpIcon(null);
        }

        this.input.setCursor(this.ui.getCursor());
    }

    animate() {
        if (!this.isRunning) return;
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.frameCount++;
        if (this.lastFrameTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (this.lastFrameTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = this.lastFrameTime;
        }

        if (this.lastFrameTime - this.lastCooldownCleanup > 5000) {
            const threshold = this.lastFrameTime - 1000;
            for (const [key, time] of this.collisionCooldowns) {
                if (time < threshold) this.collisionCooldowns.delete(key);
            }
            this.lastCooldownCleanup = this.lastFrameTime;
        }

        this.update(this.lastFrameTime, delta);
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    togglePause() {
        this.isPaused = !this.isPaused;
    }

    destroy() {
        this.isRunning = false;
        this.entities.clear();
        this.physics.destroy();
        this.audio.dispose();
        this.renderer.destroy();
    }
}
