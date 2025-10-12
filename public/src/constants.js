/**
 * Bounce Beats - Shared Constants
 * Single source of truth for musical configuration
 */

export const MUSIC_CONFIG = {
    // A minor pentatonic scale (A2-A4)
    // Frequency range: 110Hz (A2) to 440Hz (A4)
    // Optimal for web audio - clear bass without muddiness
    notes: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'],

    // Reference size for note mapping
    // Line length is mapped to notes using this fixed reference
    maxLineLength: 1200
};

/**
 * Maps line length to musical note
 * @param {number} length - Line length in pixels
 * @returns {string} - Note name (e.g., 'A3', 'C4')
 */
export function getNoteFromLength(length) {
    const noteIndex = Math.floor(
        Math.min(length / MUSIC_CONFIG.maxLineLength, 1) *
        (MUSIC_CONFIG.notes.length - 1)
    );
    return MUSIC_CONFIG.notes[noteIndex];
}

/**
 * Physics collision configuration
 * Single source of truth for Matter.js collision filters
 */
export const COLLISION_CATEGORIES = {
    BALL: 0x0001,
    LINE: 0x0002,
    ALL: 0xFFFF
};

export const COLLISION_FILTERS = {
    BALL: {
        group: -1, // Balls don't collide with each other
        category: COLLISION_CATEGORIES.BALL,
        mask: COLLISION_CATEGORIES.LINE
    },
    LINE: {
        category: COLLISION_CATEGORIES.LINE,
        mask: COLLISION_CATEGORIES.ALL
    }
};

/**
 * Physics configuration
 */
export const PHYSICS_CONFIG = {
    gravity: 0.5,
    positionIterations: 20,      // High precision for anti-tunneling
    velocityIterations: 16,      // High precision for anti-tunneling
    constraintIterations: 4,
    fixedTimeStepHz: 240,        // 240 Hz for maximum accuracy
    maxSubSteps: 4,              // Prevent physics spiral of death
    lineThickness: 12,           // Collision body thickness in pixels
    maxBallSpeed: 15             // Prevent tunneling through lines
};

/**
 * Interaction thresholds and timings
 */
export const INTERACTION_CONFIG = {
    lineHoverThreshold: 15,       // px
    spawnerHoverThreshold: 25,    // px
    endpointHoverThreshold: 20,   // px
    minDragDistance: 10,          // px before line is created
    holdThreshold: 500,           // ms to activate hold
    clickThreshold: 200,          // ms max for click
    ballSprayInterval: 150        // ms between spray balls
};

/**
 * Collision audio/visual feedback
 */
export const COLLISION_CONFIG = {
    cooldownMs: 70,               // Prevent duplicate sounds
    minSpeedForSound: 0.3,        // Below this no sound
    flashIntensityDivisor: 8      // For impact flash calculation
};

/**
 * Entity limits and intervals
 */
export const ENTITY_CONFIG = {
    maxSpawners: 5,
    spawnerIntervalMs: 1500,
    ballSprayIntervalMs: 150,
    minLineLength: 50
};
