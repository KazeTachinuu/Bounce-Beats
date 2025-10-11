# Music Bounce

Simple, satisfying music creation game. Draw lines, bounce balls, create lo-fi melodies.

## Features

- **Draw lines** - Mouse or touch to create instruments
- **Spawn balls** - Click to create bouncing notes
- **Lo-fi audio** - Warm, pleasant musical synthesis
- **Perfect physics** - 100% energy conservation, endless bouncing
- **No ball collisions** - Balls pass through each other

## Quick Start

```bash
bun install
bun run index.ts
```

Open http://localhost:3000

## Controls

- **Drag** to draw lines
- **Click** to spawn balls
- **Press C** to clear

## Tech Stack

- **Bun** - Fast JavaScript runtime and dev server
- **Matter.js** - 2D physics engine (restitution: 1.0)
- **Tone.js** - Web Audio framework (pentatonic scale, effects chain)
- **Vanilla JS** - Clean, modular ES6 (no frameworks, no bloat)

## Architecture

```
public/
├── index.html        # Entry point
└── src/
    ├── physics.js    # PhysicsEngine, Line, Ball classes
    ├── audio.js      # AudioEngine with Tone.js
    ├── renderer.js   # Canvas renderer with visual effects
    └── game.js       # Main game loop coordinator

index.ts              # Bun dev server
```

## Physics Settings

- Gravity: 0.5
- Restitution: 1.0 (100% energy conservation)
- Friction: 0 (no energy loss)
- Air resistance: 0
- Ball collision filter: -1 (balls ignore each other)

## Audio Settings

- Scale: A minor pentatonic
- Oscillator: Triangle wave
- Effects: Low-pass filter → Chorus → Reverb → Compressor
- Detune: ±5 cents (lo-fi character)

Built with [Bun](https://bun.com)
