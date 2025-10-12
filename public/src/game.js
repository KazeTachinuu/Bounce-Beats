/**
 * Game - Pure coordinator
 * Orchestrates all subsystems without business logic
 */
import { PhysicsEngine } from './physics.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './renderer.js';
import { InputController } from './InputController.js';
import { EntityManager } from './EntityManager.js';
import { UIManager } from './UIManager.js';
import { InteractionController } from './InteractionController.js';

export class Game {
    constructor(canvas) {
        // Core systems
        this.physics = new PhysicsEngine();
        this.audio = new AudioEngine();
        this.renderer = new Renderer(canvas);

        // Managers
        this.entities = new EntityManager(this.physics);
        this.ui = new UIManager();
        this.input = new InputController(canvas);
        this.interaction = new InteractionController(this.entities, this.ui, this.audio);

        // Game state
        this.isPaused = false;
        this.isRunning = true;
        this.collisionCooldowns = new Map();

        // Wire up interactions
        this.setupCallbacks();
        this.setupCollisions();
        this.animate();
    }

    // ==================== SETUP ====================

    setupCallbacks() {
        // Input callbacks
        this.input.onMouseDown = (pos) => this.interaction.handleMouseDown(pos);
        this.input.onMouseMove = (pos) => this.interaction.handleMouseMove(pos);
        this.input.onMouseUp = (event) => this.interaction.handleMouseUp(event);
        this.input.onKeyPress = (key) => this.interaction.handleKeyPress(key);

        // Pause callback for interaction controller
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

        // Collision cooldown
        const key = `${ballBody.id}-${lineBody.id}`;
        const now = Date.now();
        const last = this.collisionCooldowns.get(key) || 0;

        if (now - last > 70) {
            const speed = ball.getVelocity();
            if (speed > 0.3) {
                this.audio.playNote(line.length, speed);
                const pos = ball.getPosition();
                this.renderer.addImpactFlash(pos.x, pos.y, Math.min(speed / 8, 1));
                this.collisionCooldowns.set(key, now);
            }
        }
    }

    // ==================== GAME LOOP ====================

    update() {
        if (this.isPaused) return;

        // Update physics and entities
        this.physics.update();
        this.entities.updateBalls();
        this.entities.updateSpawners(Date.now());
        this.entities.removeOffScreenBalls(this.renderer.getHeight());

        // Update interactions
        this.interaction.update(this.input.mouse);
    }

    render() {
        this.renderer.clear();

        // Render lines
        this.entities.lines.forEach(line => {
            const isHovered = line === this.ui.hovered.line;
            const isSelected = line === this.ui.selected.line;
            this.renderer.drawLine(line, isHovered, isSelected);
        });

        // Render drawing preview
        const drawing = this.interaction.getDrawing();
        if (drawing) {
            this.renderer.drawCurrentLine(drawing, this.input.mouse.x, this.input.mouse.y);
        }

        // Render effects and balls
        this.renderer.updateAndDrawFlashes();
        this.entities.balls.forEach(ball => this.renderer.drawBall(ball));

        // Render spawners
        this.entities.spawners.forEach(spawner => {
            const isHovered = spawner === this.ui.hovered.spawner;
            this.renderer.drawSpawner(spawner, isHovered);
        });

        // Render endpoint handles
        const dragging = this.interaction.getDragging();
        if (dragging) {
            this.renderer.drawEndpoints(dragging.line);
            // Show line length/note info while dragging
            this.renderer.drawLineInfo(dragging.line, this.input.mouse.x, this.input.mouse.y);
        } else if (this.ui.hovered.endpoint && !this.ui.selected.line) {
            this.renderer.drawEndpoints(this.ui.hovered.endpoint.line);
        }

        // Render delete button
        if (this.ui.selected.line) {
            const midX = (this.ui.selected.line.x1 + this.ui.selected.line.x2) / 2;
            const midY = (this.ui.selected.line.y1 + this.ui.selected.line.y2) / 2;
            const bounds = this.renderer.drawDeleteButton(midX, midY, this.input.mouse.x, this.input.mouse.y);
            this.ui.setDeleteButton(bounds);
        } else {
            this.ui.setDeleteButton(null);
        }

        // Render overlays
        if (this.isPaused) {
            this.renderer.drawPauseOverlay();
        }

        if (this.ui.shouldShowHelp()) {
            this.renderer.drawHelp(this.ui.getHelpAlpha());
        }

        // Render stats (always visible)
        this.renderer.drawStats(
            this.entities.balls.length,
            this.entities.lines.length,
            this.entities.spawners.length
        );

        // Update cursor
        this.input.setCursor(this.ui.getCursor());
    }

    animate() {
        if (!this.isRunning) return;
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    // ==================== GAME CONTROL ====================

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
