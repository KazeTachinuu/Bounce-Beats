/**
 * Audio Engine - Tone.js wrapper for lo-fi music generation
 */
import { getNoteFromLength } from './constants.js';

export class AudioEngine {
    constructor() {
        this.isInitialized = false;
        this.synth = null;
        this.effects = null;
    }

    async init() {
        if (this.isInitialized) return;

        await Tone.start();

        // Create effects chain
        const compressor = new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.01, release: 0.2 });
        const filter = new Tone.Filter({ type: 'lowpass', frequency: 2500, rolloff: -12, Q: 0.8 });
        const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.3, wet: 0.25 }).start();
        const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01, wet: 0.35 });

        await reverb.ready;

        // Connect: filter → chorus → reverb → compressor → output
        filter.connect(chorus);
        chorus.connect(reverb);
        reverb.connect(compressor);
        compressor.toDestination();

        // Create warm synth
        this.synth = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 8,
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, attackCurve: 'exponential', decay: 0.3, sustain: 0.2, release: 0.6, releaseCurve: 'exponential' },
            volume: -8
        });

        this.synth.connect(filter);
        this.effects = { compressor, filter, chorus, reverb };
        this.isInitialized = true;
    }

    playNote(lineLength, impactSpeed) {
        if (!this.isInitialized) return;

        const note = getNoteFromLength(lineLength);
        const detune = (Math.random() - 0.5) * 10;
        const velocity = Math.min(Math.pow(impactSpeed / 12, 0.5) * 0.5 + 0.15, 1);
        const duration = Math.random() * 0.1 + 0.3;

        this.synth.triggerAttackRelease(note, duration, undefined, velocity);
        this.synth.set({ detune });
    }

    dispose() {
        if (this.synth) this.synth.dispose();
        if (this.effects) {
            Object.values(this.effects).forEach(effect => effect.dispose());
        }
    }
}
