# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bounce Beats is an interactive music creation game built with vanilla JavaScript, Matter.js physics engine, and Tone.js audio synthesis. Users draw lines and spawn balls that bounce and create lo-fi melodies on impact.

## Development Commands

### Running the Development Server
```bash
bun run index.ts
# or with hot reload
bun --hot index.ts
```
Access the game at http://localhost:3000

### Installing Dependencies
```bash
bun install
```

### Running Tests (when added)
```bash
bun test
```

## Architecture Overview

### Server Architecture (index.ts)
- Custom Bun.serve() implementation serving static files
- Routes for Matter.js and Tone.js from node_modules
- No build step required - files served directly

### Frontend Architecture (public/src/)

The codebase uses a **highly modular architecture** with clear separation of concerns:

#### Core Systems
1. **PhysicsEngine (physics.js)** - Matter.js wrapper
   - Perfect energy conservation (restitution: 1.0, no friction)
   - Collision detection with per-pair cooldowns (70ms)
   - Balls ignore each other (collision filter: -1)

2. **AudioEngine (audio.js)** - Tone.js wrapper for lo-fi synthesis
   - Lazy initialization on first user interaction
   - Pentatonic scale (A1-E5, 0-1200px mapping)
   - Effects: Low-pass filter → Chorus → Reverb → Compressor

3. **Renderer (renderer.js)** - Canvas rendering
   - Impact flashes, ball trails, visual effects
   - UI elements (delete buttons, help overlay)
   - DPI-aware rendering

#### Manager Classes (Single Responsibility)
4. **EntityManager (EntityManager.js)** - All entity operations
   - Lines: add, remove, find, update endpoints
   - Balls: add, remove, spawn, cleanup
   - Spawners: add, remove, auto-spawn logic
   - **ONE place for all entity logic**

5. **UIManager (UIManager.js)** - All UI state
   - Hover states (line, spawner, endpoint)
   - Selection state
   - Delete button bounds
   - Help overlay visibility/fade
   - **ONE place for all UI state**

6. **InputController (InputController.js)** - Raw input capture
   - Mouse/touch/keyboard event listeners
   - Input state tracking (position, down time, etc.)
   - Callback system for input events
   - **ONE place for all input handling**

7. **InteractionController (InteractionController.js)** - Interaction logic
   - "What happens when user does X"
   - Drawing, dragging, selecting logic
   - Ball spray, spawner creation
   - Priority system for click handling
   - **ONE place for all interaction logic**

8. **Game (game.js)** - Pure coordinator (~180 lines)
   - Wires up all subsystems via callbacks
   - Game loop (update/render)
   - Collision handling (audio/visual feedback)
   - **NO business logic, only orchestration**

### Architecture Benefits

**Want to change how spawners work?** → Edit `EntityManager.js` only
**Want to change click behavior?** → Edit `InteractionController.js` only
**Want to add a new UI element?** → Edit `UIManager.js` and `Renderer.js` only
**Want to change input detection?** → Edit `InputController.js` only

**Each feature is in ONE place. No artifacts when removing. Easy to extend.**

### Key Patterns

**Callback-based Communication**: Systems communicate via callbacks, no tight coupling.

**State Encapsulation**: Each manager owns its state, no shared mutable state.

**Single Responsibility**: Each class has ONE job, easy to reason about.

**No Bloat**: Game.js is pure coordinator, all logic delegated to specialists.

## Code Conventions

- ES6 modules with explicit imports/exports
- Class-based architecture for game entities
- Comments explain "why" not "what"
- No build tooling - direct browser compatibility required
- Use `const` for immutable references, avoid `var`

## Important Implementation Details

### Physics Tuning
The physics are carefully tuned for perpetual motion:
- Gravity: 0.5 (not Earth gravity, for better gameplay)
- Restitution: 1.0 (100% elastic collisions)
- All friction values: 0
- Position iterations: 10, Velocity iterations: 8 (for stability)
- Ball inertia: Infinity (prevents rotation)

### Audio Settings
- Polyphony: 8 voices maximum
- Volume: -8dB to prevent clipping with effects
- Envelope: Exponential curves for organic sound
- Detune applied per-note, not per-synth (creates variation)

### Coordinate Systems
- Canvas uses top-left origin
- Matter.js bodies use center-point positioning
- Line bodies: rectangle rotated by atan2(dy, dx)
- All coordinates in pixels

## Tech Stack

- **Bun** - Runtime and dev server (prefer `bun` over `node`, `npm`, `vite`)
- **Matter.js** - 2D rigid body physics engine
- **Tone.js** - Web Audio framework for sound synthesis
- **Vanilla JavaScript** - No frameworks (React, Vue, etc.)
- **Canvas API** - 2D rendering

## Bun Usage

Always use Bun instead of Node.js, npm, or other tools:
- `bun <file>` not `node <file>`
- `bun install` not `npm install`
- `bun test` not `jest` or `vitest`
- `Bun.serve()` not `express`
- `Bun.file()` preferred over `node:fs`

Bun automatically loads .env files - no need for dotenv package.
