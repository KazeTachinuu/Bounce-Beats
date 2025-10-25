import { getNoteFromLength } from './constants.js';

const LOUDNESS_COMPENSATION = {
    'A2': 2.8, 'C3': 2.5, 'D3': 2.3, 'E3': 2.0,
    'G3': 1.7, 'A3': 1.5, 'C4': 1.3, 'D4': 1.2,
    'E4': 1.1, 'G4': 1.05, 'A4': 1.0
};

export class AudioEngine {
    constructor() {
        this.isInitialized = false;
        this.synth = null;
        this.effects = null;
    }

    async init() {
        if (this.isInitialized) return;

        await Tone.start();

        const compressor = new Tone.Compressor({
            threshold: -24, ratio: 4, attack: 0.005, release: 0.25, knee: 6
        });
        const filter = new Tone.Filter({
            type: 'lowpass', frequency: 3500, rolloff: -12, Q: 0.7
        });

        const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.3, wet: 0.25 }).start();
        const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01, wet: 0.35 });

        await reverb.ready;

        filter.connect(chorus);
        chorus.connect(reverb);
        reverb.connect(compressor);
        compressor.toDestination();

        this.synth = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 8,
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, attackCurve: 'exponential', decay: 0.3, sustain: 0.2, release: 0.6, releaseCurve: 'exponential' },
            volume: -12
        });

        this.synth.connect(filter);
        this.effects = { compressor, filter, chorus, reverb };
        this.isInitialized = true;
    }

    playNote(lineLength, impactSpeed) {
        if (!this.isInitialized) return;

        const note = getNoteFromLength(lineLength);
        const detune = (Math.random() - 0.5) * 10;
        const baseVelocity = Math.pow(impactSpeed / 12, 0.5) * 0.5 + 0.15;
        const velocity = Math.min(baseVelocity * (LOUDNESS_COMPENSATION[note] || 1.0), 1);
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
