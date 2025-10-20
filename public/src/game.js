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
import { COLLISION_CONFIG } from './constants.js';

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
        this.lastCooldownCleanup = 0;

        // FPS counter
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.lastFrameTime = performance.now();

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
        this.input.onKeyUp = (key) => this.interaction.handleKeyUp(key);
        this.input.onWheel = (delta, pos) => this.handleWheel(delta, pos);

        // Pause callback for interaction controller
        this.interaction.togglePause = () => this.togglePause();
    }

    handleWheel(delta, pos) {
        // Adjust spawner rhythm with scroll wheel
        const spawner = this.entities.findNearestSpawner(pos.x, pos.y, 50);
        if (spawner) {
            const currentInterval = spawner.interval || 1500;
            const newInterval = currentInterval + delta * 50; // 50ms per scroll tick
            this.entities.setSpawnerInterval(spawner, newInterval);
        }
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
        const now = this.lastFrameTime;
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

    // ==================== GAME LOOP ====================

    update(timestamp, delta) {
        if (this.isPaused) return;

        // Update physics and entities
        this.physics.update(delta);
        this.entities.updateBalls();
        this.entities.updateSpawners(timestamp);
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

        // Render area selection
        const areaSelection = this.ui.getAreaSelection();
        if (areaSelection) {
            this.renderer.drawAreaSelection(areaSelection);
        }

        // Render multi-selection
        const multiSelection = this.ui.getSelectedMultiple();
        const hasMultiSelection = multiSelection.lines.length > 0 || multiSelection.spawners.length > 0;

        if (hasMultiSelection) {
            const boundsAndHandles = this.renderer.drawMultiSelection(multiSelection.lines, multiSelection.spawners);
            this.ui.setMultiSelectionBounds(boundsAndHandles);
        } else {
            this.ui.setMultiSelectionBounds(null);
        }

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
            this.renderer.drawSpawner(spawner, isHovered, this.lastFrameTime);
        });

        // Render endpoint handles
        const dragging = this.interaction.getDragging();
        const showingHelp = this.ui.shouldShowHelp();

        if (dragging && dragging.line) {
            this.renderer.drawEndpoints(dragging.line);
            // Show line length/note info while dragging (unless help is showing for all lines)
            if (!showingHelp) {
                this.renderer.drawLineInfo(dragging.line, this.input.mouse.x, this.input.mouse.y);
            }
        } else if (this.ui.hovered.endpoint && !this.ui.selected.line) {
            this.renderer.drawEndpoints(this.ui.hovered.endpoint.line);
        }

        // Render delete button

        if (hasMultiSelection && this.ui.multiSelectionBounds) {
            // Delete button for multi-selection - centered on bounding box
            const bounds = this.ui.multiSelectionBounds.bounds;
            const centerX = (bounds.minX + bounds.maxX) / 2;
            const centerY = bounds.minY - 20; // Above the selection
            const btnBounds = this.renderer.drawDeleteButton(centerX, centerY, this.input.mouse.x, this.input.mouse.y);
            this.ui.setDeleteButton(btnBounds);
        } else if (this.ui.selected.line) {
            // Delete button for single line selection
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
            // Show line info for all lines when help is visible
            this.entities.lines.forEach(line => {
                const midX = (line.x1 + line.x2) / 2;
                const midY = (line.y1 + line.y2) / 2;
                this.renderer.drawLineInfo(line, midX, midY);
            });
        }

        // Render stats (if visible)
        if (this.ui.shouldShowStats()) {
            this.renderer.drawStats(
                this.entities.balls.length,
                this.entities.lines.length,
                this.entities.spawners.length,
                this.fps
            );
            // Update help icon bounds for click detection
            const helpIconBounds = this.renderer.getHelpIconBounds();
            if (helpIconBounds) {
                this.ui.setHelpIcon(helpIconBounds);
            }
        } else {
            this.ui.setHelpIcon(null);
        }

        // Update cursor
        this.input.setCursor(this.ui.getCursor(this.input.mouse.x, this.input.mouse.y));
    }

    animate() {
        if (!this.isRunning) return;

        // Calculate delta time
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Calculate FPS
        this.frameCount++;
        if (this.lastFrameTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (this.lastFrameTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = this.lastFrameTime;
        }

        // Cleanup collision cooldowns every 5 seconds to prevent memory leak
        if (this.lastFrameTime - this.lastCooldownCleanup > 5000) {
            const threshold = this.lastFrameTime - 1000;
            for (const [key, time] of this.collisionCooldowns) {
                if (time < threshold) {
                    this.collisionCooldowns.delete(key);
                }
            }
            this.lastCooldownCleanup = this.lastFrameTime;
        }

        this.update(this.lastFrameTime, delta);
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
