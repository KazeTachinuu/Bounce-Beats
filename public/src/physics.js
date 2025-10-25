import { COLLISION_FILTERS, PHYSICS_CONFIG } from './constants.js';

export class PhysicsEngine {
    constructor() {
        this.engine = Matter.Engine.create();
        this.engine.gravity.y = PHYSICS_CONFIG.gravity;
        this.engine.positionIterations = PHYSICS_CONFIG.positionIterations;
        this.engine.velocityIterations = PHYSICS_CONFIG.velocityIterations;
        this.engine.enableSleeping = false;
        this.engine.constraintIterations = PHYSICS_CONFIG.constraintIterations;
        this.engine.timing.timeScale = 2;
        this.world = this.engine.world;
        this.fixedTimeStep = 1000 / PHYSICS_CONFIG.fixedTimeStepHz;
        this.accumulator = 0;
        this.maxSubSteps = PHYSICS_CONFIG.maxSubSteps;
    }

    update(delta = 1000 / 60) {
        this.accumulator += Math.min(delta, 100);

        let subSteps = 0;
        while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
            Matter.Engine.update(this.engine, this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
            subSteps++;
        }

        if (subSteps >= this.maxSubSteps) this.accumulator = 0;
    }

    addBody(body) {
        Matter.World.add(this.world, body);
    }

    removeBody(body) {
        Matter.World.remove(this.world, body);
    }

    onCollision(callback) {
        Matter.Events.on(this.engine, 'collisionStart', callback);
    }

    destroy() {
        Matter.Events.off(this.engine);
        Matter.Engine.clear(this.engine);
    }
}

export class Line {
    static createBodyConfig(angle) {
        return {
            isStatic: true, angle,
            friction: 0, frictionStatic: 0, frictionAir: 0,
            restitution: 1.0, slop: 0, chamfer: { radius: 1 },
            label: 'line', isSensor: false,
            collisionFilter: COLLISION_FILTERS.LINE
        };
    }

    constructor(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.length = Math.hypot(x2 - x1, y2 - y1);

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        this.body = Matter.Bodies.rectangle(
            centerX, centerY, this.length, PHYSICS_CONFIG.lineThickness,
            Line.createBodyConfig(angle)
        );
    }

    getBody() {
        return this.body;
    }

    updatePosition(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.length = Math.hypot(x2 - x1, y2 - y1);

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        const oldBody = this.body;
        this.body = Matter.Bodies.rectangle(
            centerX, centerY, this.length, PHYSICS_CONFIG.lineThickness,
            Line.createBodyConfig(angle)
        );
        return { oldBody, newBody: this.body };
    }

    distanceToPoint(x, y) {
        const dx = this.x2 - this.x1;
        const dy = this.y2 - this.y1;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) return Math.hypot(x - this.x1, y - this.y1);

        const t = Math.max(0, Math.min(1, ((x - this.x1) * dx + (y - this.y1) * dy) / lengthSq));
        const projX = this.x1 + t * dx;
        const projY = this.y1 + t * dy;

        return Math.hypot(x - projX, y - projY);
    }

    distanceToEndpoint(x, y, endpoint) {
        if (endpoint === 'start') {
            return Math.hypot(x - this.x1, y - this.y1);
        } else {
            return Math.hypot(x - this.x2, y - this.y2);
        }
    }
}

export class Ball {
    constructor(x, y, radius = 8) {
        this.radius = radius;
        this.trail = [];
        this.maxTrailLength = 10;
        this.maxSpeed = PHYSICS_CONFIG.maxBallSpeed;

        this.body = Matter.Bodies.circle(x, y, radius, {
            restitution: 1.0, friction: 0, frictionStatic: 0, frictionAir: 0,
            density: 0.002, inertia: Infinity, slop: 0, label: 'ball',
            collisionFilter: COLLISION_FILTERS.BALL
        });
    }

    update() {
        this.trail.push({ x: this.body.position.x, y: this.body.position.y });
        if (this.trail.length > this.maxTrailLength) this.trail.shift();

        const velocity = this.body.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

        if (speed > this.maxSpeed) {
            const scale = this.maxSpeed / speed;
            Matter.Body.setVelocity(this.body, {
                x: velocity.x * scale,
                y: velocity.y * scale
            });
        }
    }

    getPosition() {
        return this.body.position;
    }

    getVelocity() {
        return Matter.Vector.magnitude(this.body.velocity);
    }

    getTrail() {
        return this.trail;
    }

    isOffScreen(height) {
        return this.body.position.y > height + 200;
    }

    getBody() {
        return this.body;
    }
}
