export const MUSIC_CONFIG = {
    notes: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
    maxLineLength: 1200
};

export function getNoteFromLength(length) {
    const noteIndex = Math.floor(
        Math.min(length / MUSIC_CONFIG.maxLineLength, 1) *
        (MUSIC_CONFIG.notes.length - 1)
    );
    return MUSIC_CONFIG.notes[noteIndex];
}

export const COLLISION_CATEGORIES = {
    BALL: 0x0001,
    LINE: 0x0002,
    ALL: 0xFFFF
};

export const COLLISION_FILTERS = {
    BALL: {
        group: -1,
        category: COLLISION_CATEGORIES.BALL,
        mask: COLLISION_CATEGORIES.LINE
    },
    LINE: {
        category: COLLISION_CATEGORIES.LINE,
        mask: COLLISION_CATEGORIES.ALL
    }
};

export const PHYSICS_CONFIG = {
    gravity: 0.5,
    positionIterations: 20,
    velocityIterations: 16,
    constraintIterations: 4,
    lineThickness: 12,
    maxBallSpeed: 15
};

export const INTERACTION_CONFIG = {
    lineHoverThreshold: 25,
    spawnerHoverThreshold: 35,
    endpointHoverThreshold: 30,
    minDragDistance: 10,
    holdThreshold: 500,
    clickThreshold: 200,
    ballSprayInterval: 150
};

export const COLLISION_CONFIG = {
    cooldownMs: 70,
    minSpeedForSound: 0.3,
    flashIntensityDivisor: 8
};

export const ENTITY_CONFIG = {
    maxSpawners: 5,
    spawnerIntervalMs: 1500,
    ballSprayIntervalMs: 150,
    minLineLength: 50
};
