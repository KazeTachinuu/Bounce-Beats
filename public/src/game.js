/**
 * Game - Main game loop and coordination
 */
import { PhysicsEngine, Line, Ball } from './physics.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './renderer.js';

export class Game {
    constructor(canvas) {
        this.physics = new PhysicsEngine();
        this.audio = new AudioEngine();
        this.renderer = new Renderer(canvas);

        this.lines = [];
        this.balls = [];
        this.isDrawing = false;
        this.currentLine = null;
        this.collisionCooldowns = new Map();
        this.isRunning = true;

        this.setupCollisions();
        this.setupInput(canvas);
        this.animate();
    }

    setupCollisions() {
        this.physics.onCollision((event) => {
            event.pairs.forEach((pair) => {
                const { bodyA, bodyB } = pair;
                const ball = bodyA.circleRadius ? bodyA : bodyB;
                const line = ball === bodyA ? bodyB : bodyA;

                if (ball.circleRadius && line.isStatic) {
                    const ballObj = this.balls.find(b => b.getBody() === ball);
                    const lineObj = this.lines.find(l => l.getBody() === line);
                    if (ballObj && lineObj) this.handleCollision(ballObj, lineObj);
                }
            });
        });
    }

    handleCollision(ball, line) {
        const key = `${ball.getBody().id}-${line.getBody().id}`;
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

    setupInput(canvas) {
        canvas.addEventListener('mousedown', (e) => {
            this.startDrawing(e.clientX, e.clientY);
            this.audio.init();
        });

        canvas.addEventListener('mousemove', (e) => {
            this.updateDrawing(e.clientX, e.clientY);
        });

        canvas.addEventListener('mouseup', (e) => {
            this.stopDrawing();
            if (!this.isDrawing) {
                this.spawnBall(e.clientX, e.clientY);
            }
        });

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrawing(touch.clientX, touch.clientY);
            this.audio.init();
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.updateDrawing(touch.clientX, touch.clientY);
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'c') {
                this.clear();
            }
        });
    }

    startDrawing(x, y) {
        this.isDrawing = true;
        this.currentLine = { x1: x, y1: y, x2: x, y2: y };
    }

    updateDrawing(x, y) {
        if (this.isDrawing && this.currentLine) {
            this.currentLine.x2 = x;
            this.currentLine.y2 = y;
        }
    }

    stopDrawing() {
        if (this.isDrawing && this.currentLine) {
            const length = Math.hypot(
                this.currentLine.x2 - this.currentLine.x1,
                this.currentLine.y2 - this.currentLine.y1
            );

            if (length > 15) {
                const line = new Line(
                    this.currentLine.x1,
                    this.currentLine.y1,
                    this.currentLine.x2,
                    this.currentLine.y2
                );

                this.lines.push(line);
                this.physics.addBody(line.getBody());
            }

            this.currentLine = null;
            this.isDrawing = false;
        }
    }

    spawnBall(x, y) {
        if (!this.isDrawing) {
            const ball = new Ball(x, y);
            this.balls.push(ball);
            this.physics.addBody(ball.getBody());
        }
    }

    clear() {
        this.lines.forEach(line => this.physics.removeBody(line.getBody()));
        this.balls.forEach(ball => this.physics.removeBody(ball.getBody()));
        this.lines = [];
        this.balls = [];
        this.collisionCooldowns.clear();
    }

    update() {
        this.physics.update();
        this.balls.forEach(ball => ball.update());

        for (let i = this.balls.length - 1; i >= 0; i--) {
            if (this.balls[i].isOffScreen(this.renderer.getHeight())) {
                this.physics.removeBody(this.balls[i].getBody());
                this.balls.splice(i, 1);
            }
        }
    }

    render() {
        this.renderer.clear();
        this.lines.forEach(line => this.renderer.drawLine(line));
        if (this.isDrawing) this.renderer.drawCurrentLine(this.currentLine);
        this.renderer.updateAndDrawFlashes();
        this.balls.forEach(ball => this.renderer.drawBall(ball));
    }

    animate() {
        if (!this.isRunning) return;
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    destroy() {
        this.isRunning = false;
        this.clear();
        this.physics.destroy();
        this.audio.dispose();
        this.renderer.destroy();
    }
}
