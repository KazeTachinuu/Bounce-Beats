/**
 * Physics Engine - Matter.js wrapper
 * Handles physics simulation and collision detection
 */
import { COLLISION_FILTERS, PHYSICS_CONFIG } from './constants.js';

export class PhysicsEngine {
    constructor() {
        this.engine = Matter.Engine.create();

        // Maximum collision detection settings - AGGRESSIVE anti-tunneling
        this.engine.gravity.y = PHYSICS_CONFIG.gravity;
        this.engine.positionIterations = PHYSICS_CONFIG.positionIterations;
        this.engine.velocityIterations = PHYSICS_CONFIG.velocityIterations;
        this.engine.enableSleeping = false;

        // Tighter constraint solving
        this.engine.constraintIterations = PHYSICS_CONFIG.constraintIterations;
        this.engine.timing.timeScale = 1; // Normal time scale

        this.world = this.engine.world;

        // Very small fixed timestep for maximum accuracy
        this.fixedTimeStep = 1000 / PHYSICS_CONFIG.fixedTimeStepHz;
        this.accumulator = 0;
        this.maxSubSteps = PHYSICS_CONFIG.maxSubSteps;
    }

    update(delta = 1000 / 60) {
        // Cap delta to prevent death spiral
        delta = Math.min(delta, 1000 / 30);

        // Fixed timestep physics for consistent collision detection
        this.accumulator += delta;

        let subSteps = 0;
        // Run multiple smaller physics steps to prevent tunneling
        while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
            Matter.Engine.update(this.engine, this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
            subSteps++;
        }

        // Drain accumulator if too many substeps needed
        if (subSteps >= this.maxSubSteps) {
            this.accumulator = 0;
        }
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

/**
 * Line - Drawable line that balls bounce off
 */
export class Line {
    static createBodyConfig(angle) {
        return {
            isStatic: true,
            angle: angle,
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0,
            restitution: 1.0,
            slop: 0, // No penetration tolerance - strict collision
            chamfer: { radius: 1 }, // Minimal chamfer for sharp collision edges
            label: 'line',
            isSensor: false,
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

        // Thicker collision body for reliable collision detection
        // Using 12px thickness - good balance between detection and visual accuracy
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

        // Recreate the body with new dimensions to avoid scaling issues
        const oldBody = this.body;

        // Create new body with correct dimensions
        this.body = Matter.Bodies.rectangle(
            centerX, centerY, this.length, PHYSICS_CONFIG.lineThickness,
            Line.createBodyConfig(angle)
        );

        // Return both old and new body so EntityManager can swap them in the world
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

/**
 * Ball - Bouncing ball that creates music
 */
export class Ball {
    constructor(x, y, radius = 8) {
        this.radius = radius;
        this.trail = [];
        this.maxTrailLength = 10;

        this.body = Matter.Bodies.circle(x, y, radius, {
            restitution: 1.0,
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0,
            density: 0.002,
            inertia: Infinity,
            slop: 0, // No penetration tolerance - strict collision
            label: 'ball',
            collisionFilter: COLLISION_FILTERS.BALL
        });

        // Set velocity limit to prevent extreme speeds that cause tunneling
        this.maxSpeed = PHYSICS_CONFIG.maxBallSpeed;
    }

    update() {
        this.trail.push({ x: this.body.position.x, y: this.body.position.y });
        if (this.trail.length > this.maxTrailLength) this.trail.shift();

        // Clamp velocity to prevent tunneling through lines
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
