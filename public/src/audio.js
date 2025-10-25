/**
 * Audio Engine - Tone.js wrapper for lo-fi music generation
 */
import { getNoteFromLength } from './constants.js';

/**
 * Equal-loudness compensation based on Fletcher-Munson curves
 * Maps note names to loudness compensation factors
 * Lower frequencies require higher amplitude to sound equally loud
 *
 * Reference: ISO 226:2003 equal-loudness contours at ~60 phon
 * Compensation values are linear gain multipliers
 */
const LOUDNESS_COMPENSATION = {
    // A2-E3: Very low frequencies need significant boost (~+8 to +10 dB)
    'A2': 2.8,   // 110 Hz - Needs ~+9 dB
    'C3': 2.5,   // 130 Hz - Needs ~+8 dB
    'D3': 2.3,   // 147 Hz - Needs ~+7 dB
    'E3': 2.0,   // 165 Hz - Needs ~+6 dB

    // G3-A3: Low-mid frequencies need moderate boost (~+4 to +5 dB)
    'G3': 1.7,   // 196 Hz - Needs ~+4.5 dB
    'A3': 1.5,   // 220 Hz - Needs ~+3.5 dB

    // C4-A4: Mid frequencies need minimal boost (~+1 to +2 dB)
    'C4': 1.3,   // 262 Hz - Needs ~+2 dB
    'D4': 1.2,   // 294 Hz - Needs ~+1.5 dB
    'E4': 1.1,   // 330 Hz - Needs ~+1 dB
    'G4': 1.05,  // 392 Hz - Needs ~+0.5 dB
    'A4': 1.0    // 440 Hz - Reference (no compensation)
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

        // Create effects chain with optimized settings for frequency-compensated audio
        // Compressor settings adjusted for wider dynamic range due to loudness compensation
        const compressor = new Tone.Compressor({
            threshold: -24,    // Lower threshold to catch compensated low-freq peaks
            ratio: 4,          // Higher ratio for smoother leveling
            attack: 0.005,     // Faster attack to control transients
            release: 0.25,     // Slightly longer release for natural sound
            knee: 6            // Soft knee for transparent compression
        });

        // Filter settings optimized for A2-A4 range (110-440 Hz fundamental + harmonics)
        const filter = new Tone.Filter({
            type: 'lowpass',
            frequency: 3500,   // Increased cutoff to preserve harmonics of compensated low notes
            rolloff: -12,
            Q: 0.7             // Slightly gentler resonance
        });

        const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.3, wet: 0.25 }).start();
        const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01, wet: 0.35 });

        await reverb.ready;

        // Connect: filter → chorus → reverb → compressor → output
        filter.connect(chorus);
        chorus.connect(reverb);
        reverb.connect(compressor);
        compressor.toDestination();

        // Create warm synth with adjusted volume for compensated system
        this.synth = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 8,
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, attackCurve: 'exponential', decay: 0.3, sustain: 0.2, release: 0.6, releaseCurve: 'exponential' },
            volume: -12        // Reduced from -8 to account for loudness compensation boost
        });

        this.synth.connect(filter);
        this.effects = { compressor, filter, chorus, reverb };
        this.isInitialized = true;
    }

    playNote(lineLength, impactSpeed) {
        if (!this.isInitialized) return;

        const note = getNoteFromLength(lineLength);
        const detune = (Math.random() - 0.5) * 10;

        // Calculate base velocity from impact speed
        const baseVelocity = Math.pow(impactSpeed / 12, 0.5) * 0.5 + 0.15;

        // Apply equal-loudness compensation to normalize perceived volume
        // Lower frequencies get boosted to sound as loud as higher frequencies
        const compensationFactor = LOUDNESS_COMPENSATION[note] || 1.0;
        const compensatedVelocity = Math.min(baseVelocity * compensationFactor, 1);

        const duration = Math.random() * 0.1 + 0.3;

        this.synth.triggerAttackRelease(note, duration, undefined, compensatedVelocity);
        this.synth.set({ detune });
    }

    dispose() {
        if (this.synth) this.synth.dispose();
        if (this.effects) {
            Object.values(this.effects).forEach(effect => effect.dispose());
        }
    }
}
