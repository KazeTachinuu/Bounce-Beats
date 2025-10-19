import { Line, Ball } from './physics.js';
import { ENTITY_CONFIG } from './constants.js';

export class EntityManager {
    constructor(physics) {
        this.physics = physics;
        this.lines = [];
        this.balls = [];
        this.spawners = [];
        this.welcomeBalls = [];
        this.welcomeLines = [];
        this.config = {
            maxSpawners: ENTITY_CONFIG.maxSpawners,
            spawnerInterval: ENTITY_CONFIG.spawnerIntervalMs,
            minLineLength: ENTITY_CONFIG.minLineLength
        };
    }

    _removeFromArray(array, item) {
        const index = array.indexOf(item);
        if (index > -1) array.splice(index, 1);
    }

    _clearPhysicsEntities(array) {
        array.forEach(entity => this.physics.removeBody(entity.getBody()));
        return [];
    }

    addLine(x1, y1, x2, y2) {
        const length = Math.hypot(x2 - x1, y2 - y1);
        if (length < this.config.minLineLength) return null;

        const line = new Line(x1, y1, x2, y2);
        this.lines.push(line);
        this.physics.addBody(line.getBody());
        return line;
    }

    removeLine(line) {
        if (!line) return;
        this.physics.removeBody(line.getBody());
        this._removeFromArray(this.lines, line);
    }

    removeLastLine() {
        if (this.lines.length === 0) return;
        const line = this.lines.pop();
        this.physics.removeBody(line.getBody());
    }

    clearLines() {
        this.lines = this._clearPhysicsEntities(this.lines);
    }

    findNearestLine(x, y, threshold) {
        for (const line of this.lines) {
            if (line.distanceToPoint(x, y) < threshold) return line;
        }
        return null;
    }

    findNearestEndpoint(x, y, threshold) {
        for (const line of this.lines) {
            if (line.distanceToEndpoint(x, y, 'start') < threshold) {
                return { line, endpoint: 'start' };
            }
            if (line.distanceToEndpoint(x, y, 'end') < threshold) {
                return { line, endpoint: 'end' };
            }
        }
        return null;
    }

    updateLineEndpoint(line, endpoint, x, y) {
        const result = endpoint === 'start'
            ? line.updatePosition(x, y, line.x2, line.y2)
            : line.updatePosition(line.x1, line.y1, x, y);
        if (result) {
            this.physics.removeBody(result.oldBody);
            this.physics.addBody(result.newBody);
        }
    }

    updateLinePosition(line, x1, y1, x2, y2) {
        const result = line.updatePosition(x1, y1, x2, y2);
        if (result) {
            this.physics.removeBody(result.oldBody);
            this.physics.addBody(result.newBody);
        }
    }

    addBall(x, y) {
        const ball = new Ball(x, y);
        this.balls.push(ball);
        this.physics.addBody(ball.getBody());
        return ball;
    }

    removeBall(ball) {
        if (!ball) return;
        this.physics.removeBody(ball.getBody());
        this._removeFromArray(this.balls, ball);
    }

    clearBalls() {
        this.balls = this._clearPhysicsEntities(this.balls);
    }

    updateBalls() {
        this.balls.forEach(ball => ball.update());
    }

    removeOffScreenBalls(screenHeight) {
        for (let i = this.balls.length - 1; i >= 0; i--) {
            if (this.balls[i].isOffScreen(screenHeight)) {
                this.removeBall(this.balls[i]);
            }
        }
    }

    // ==================== SPAWNERS ====================

    addSpawner(x, y) {
        if (this.spawners.length >= this.config.maxSpawners) return null;
        const spawner = { x, y, lastSpawn: 0 };
        this.spawners.push(spawner);
        return spawner;
    }

    removeSpawner(spawner) {
        if (!spawner) return;
        this._removeFromArray(this.spawners, spawner);
    }

    clearSpawners() {
        this.spawners = [];
    }

    findNearestSpawner(x, y, threshold) {
        for (const spawner of this.spawners) {
            if (Math.hypot(spawner.x - x, spawner.y - y) < threshold) {
                return spawner;
            }
        }
        return null;
    }

    updateSpawners(now) {
        this.spawners.forEach(spawner => {
            if (now - spawner.lastSpawn > this.config.spawnerInterval) {
                this.addBall(spawner.x, spawner.y);
                spawner.lastSpawn = now;
            }
        });
    }

    clear() {
        this.clearLines();
        this.clearBalls();
        this.clearSpawners();
    }

    getBallAtBody(body) {
        const ball = this.balls.find(b => b.getBody() === body);
        if (ball) return ball;
        if (this.welcomeBalls.length > 0) {
            return this.welcomeBalls.find(b => b.getBody() === body);
        }
        return null;
    }

    getLineAtBody(body) {
        const line = this.lines.find(l => l.getBody() === body);
        if (line) return line;
        if (this.welcomeLines.length > 0) {
            return this.welcomeLines.find(l => l.getBody() === body);
        }
        return null;
    }

    createWelcomeBalls(positions) {
        this.clearWelcomeBalls();
        positions.forEach(pos => {
            const ball = new Ball(pos.x, pos.y);
            const body = ball.getBody();
            Matter.Body.setStatic(body, true);
            ball.letterIndex = pos.letterIndex || 0;
            this.welcomeBalls.push(ball);
            this.physics.addBody(body);
        });
    }

    createWelcomeLines(y) {
        const margin = 50;
        const tilt = 60;
        const line1 = new Line(margin, y - tilt, window.innerWidth - margin, y + tilt);
        const line2 = new Line(margin, y + tilt, window.innerWidth - margin, y - tilt);
        this.welcomeLines.push(line1, line2);
        this.physics.addBody(line1.getBody());
        this.physics.addBody(line2.getBody());
    }

    startWelcomeBallsFall() {
        this.welcomeFallStartTime = Date.now();
    }

    updateWelcomeBallsFall() {
        if (!this.welcomeFallStartTime) return;
        const elapsed = Date.now() - this.welcomeFallStartTime;
        const letterDelay = 80;
        this.welcomeBalls.forEach(ball => {
            const body = ball.getBody();
            if (body.isStatic && elapsed >= ball.letterIndex * letterDelay) {
                Matter.Body.setStatic(body, false);
            }
        });
    }

    clearWelcomeBalls() {
        this.welcomeBalls.forEach(ball => this.physics.removeBody(ball.getBody()));
        this.welcomeBalls = [];
    }

    clearWelcomeLines() {
        this.welcomeLines.forEach(line => this.physics.removeBody(line.getBody()));
        this.welcomeLines = [];
    }

    clearWelcomeScreen() {
        this.clearWelcomeLines();
    }
}
