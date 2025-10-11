/**
 * Physics Engine - Matter.js wrapper
 * Handles physics simulation and collision detection
 */
export class PhysicsEngine {
    constructor() {
        this.engine = Matter.Engine.create();

        // Perfect collision settings
        this.engine.gravity.y = 0.5;
        this.engine.positionIterations = 10;
        this.engine.velocityIterations = 8;
        this.engine.enableSleeping = false;

        this.world = this.engine.world;
    }

    update(delta = 1000 / 60) {
        Matter.Engine.update(this.engine, delta);
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
    constructor(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.length = Math.hypot(x2 - x1, y2 - y1);

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        this.body = Matter.Bodies.rectangle(centerX, centerY, this.length, 10, {
            isStatic: true,
            angle: angle,
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0,
            restitution: 1.0,
            slop: 0.01,
            chamfer: { radius: 4 },
            label: 'line'
        });
    }

    getBody() {
        return this.body;
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
            slop: 0.01,
            label: 'ball',
            collisionFilter: { group: -1 } // Balls don't collide with each other
        });
    }

    update() {
        this.trail.push({ x: this.body.position.x, y: this.body.position.y });
        if (this.trail.length > this.maxTrailLength) this.trail.shift();
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
