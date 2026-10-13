// ---- scale ----
// A line's length works like a string: half the length is exactly one octave up,
// in every scale. Within an octave, the scale's notes sit at evenly spaced lengths,
// like frets. The scale decides what each fret sounds like, so switching scale
// replays the same shapes in a new mood.

let ctx, input, click, voices = 0;  // the audio engine, created on the first tap

// Musical themes: each is a real scale used in that style. Lo-fi also gets a warmer,
// muffled tone, like a worn record.
export const SCALES = [
    ['Pentatonic', [0, 3, 5, 7, 10]],      // minor pentatonic
    ['Major', [0, 2, 4, 5, 7, 9, 11]],
    ['Minor', [0, 2, 3, 5, 7, 8, 10]],     // natural minor
    ['Lo-fi', [0, 2, 3, 5, 7, 9, 10], { tone: 2200 }],  // Dorian, the jazzy minor of lo-fi hip-hop
    ['Japanese', [0, 2, 3, 7, 8]],         // Hirajoshi
];
const BRIGHT_TONE = 5200;  // Hz, the default lowpass: warm but clear
const tone = () => SCALES[music.scale][2]?.tone ?? BRIGHT_TONE;
const ROOT = 45;           // A2, in 12-tone equal temperament, A4 = 440 Hz
const OCTAVES = 3;
const LONGEST_LINE = 1200; // px, the lowest note; each halving is an octave up
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const LEVELS = 8;  // per-note volume steps of 4 dB; 0 mutes
export const music = { scale: 0, instrument: 0, levels: [] };
export let NOTES = [];  // [name, midi, exact line length], low to high

export function setScale(scale) {
    music.scale = scale;
    input?.frequency.setTargetAtTime(tone(), ctx.currentTime, 0.1);
    const intervals = SCALES[scale][1];
    const notes = [];
    for (let octave = 0; octave < OCTAVES; octave++) {
        intervals.forEach((interval, degree) => notes.push([ROOT + 12 * octave + interval, octave + degree / intervals.length]));
    }
    notes.push([ROOT + 12 * OCTAVES, OCTAVES]);
    NOTES = notes.map(([midi, position]) => [NAMES[midi % 12] + (Math.floor(midi / 12) - 1), midi, LONGEST_LINE * 2 ** -position]);
    music.levels = NOTES.map((_, i) => music.levels[i] ?? LEVELS);
}

const levelGain = (level) => (level ? 10 ** (((level - LEVELS) * 4) / 20) : 0);
setScale(0);

export function noteFor(length) {
    const degrees = SCALES[music.scale][1].length;
    const position = Math.log2(LONGEST_LINE / Math.max(length, 1));  // octaves above the root
    const index = Math.round(position * degrees);
    return NOTES[Math.max(0, Math.min(NOTES.length - 1, index))];
}

// The exact line length that plays `note` (the inverse of noteFor).
export const lengthFor = (note) => note[2];

const LISTENING_PHON = 80;      // assumed listening level (normal volume) for loudness compensation
const MAX_VOICES = 16;
const VOLUME = 0.1;

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// ---- equal loudness, ISO 226:2003 ----
// SPL a pure tone needs to sound as loud as `phon` (a 1 kHz tone at `phon` dB).
// Table rows 100 Hz .. 2 kHz, interpolated on a log-frequency axis.

const ISO_F = [100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000];
const ISO_AF = [0.367, 0.349, 0.330, 0.315, 0.301, 0.288, 0.276, 0.267, 0.259, 0.253, 0.250, 0.246, 0.244, 0.243];
const ISO_LU = [-8.1, -6.2, -4.5, -3.1, -2.0, -1.1, -0.4, 0.0, 0.3, 0.5, 0.0, -2.7, -4.1, -1.0];
const ISO_TF = [26.5, 22.1, 17.9, 14.4, 11.4, 8.6, 6.2, 4.4, 3.0, 2.2, 2.4, 3.5, 1.7, -1.3];

function equalLoudnessSpl(f, phon) {
    f = Math.min(Math.max(f, ISO_F[0]), ISO_F.at(-1));
    const i = Math.max(0, ISO_F.findIndex((x) => x >= f) - 1);
    const t = Math.log(f / ISO_F[i]) / Math.log(ISO_F[i + 1] / ISO_F[i]);
    const at = (row) => row[i] + (row[i + 1] - row[i]) * t;
    const af = at(ISO_AF), lu = at(ISO_LU), tf = at(ISO_TF);
    const a = 4.47e-3 * (10 ** (0.025 * phon) - 1.15) + (0.4 * 10 ** ((tf + lu) / 10 - 9)) ** af;
    return (10 / af) * Math.log10(a) - lu + 94;
}

// Linear gain that makes a sine at `f` sound as loud as one at 1 kHz.
const REFERENCE_SPL = equalLoudnessSpl(1000, LISTENING_PHON);
const loudness = (f) => 10 ** ((equalLoudnessSpl(f, LISTENING_PHON) - REFERENCE_SPL) / 20);

// ---- engine ----

export const INSTRUMENTS = ['Marimba', 'Bell', 'Keys', 'Synth'];

// Must run inside a user gesture: browsers keep audio locked until then.
export function unlock() {
    if (ctx) return ctx.resume();
    ctx = new AudioContext({ latencyHint: 'interactive' });

    const limiter = new DynamicsCompressorNode(ctx, { threshold: -14, knee: 8, ratio: 6, attack: 0.003, release: 0.2 });
    limiter.connect(ctx.destination);

    // Gentle lowpass for a warm, lo-fi top end.
    input = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: tone(), Q: 0.5 });
    input.connect(limiter);

    click = new AudioBuffer({ length: Math.round(ctx.sampleRate * 0.03), sampleRate: ctx.sampleRate });
    click.getChannelData(0).forEach((_, i, data) => { data[i] = Math.random() * 2 - 1; });

    const preDelay = new DelayNode(ctx, { delayTime: 0.018 });
    const reverb = new ConvolverNode(ctx, { buffer: room(2.4) });
    input.connect(preDelay).connect(reverb).connect(new GainNode(ctx, { gain: 0.3 })).connect(limiter);
}

// One struck note on the current instrument. Every partial is loudness-compensated
// at its own frequency (ISO 226), so all notes sound equally loud.
//  Marimba: sine fundamental, the bar's first overtone (tuned two octaves up) and a
//           short filtered-noise strike.
//  Bell:    the partials of a free metal bar, as in a glockenspiel (1 : 2.756 : 5.404),
//           with a long ring.
//  Keys:    FM electric piano: a sine carrier modulated at the same frequency, with
//           the modulation fading quickly (bright attack, mellow tail), as in DX-style pianos.
//  Synth:   a square wave, chiptune style, softened by a lowpass.
export function play(note, impactSpeed, pan = 0) {
    const mix = levelGain(music.levels[NOTES.indexOf(note)] ?? LEVELS);
    if (ctx?.state !== 'running' || voices >= MAX_VOICES || !mix) return;
    const midi = note[1];

    const f = hz(midi);
    const hit = Math.min(Math.sqrt(impactSpeed / 2400), 1);           // 0..1
    const peak = VOLUME * mix * (0.3 + 0.7 * hit);
    const ring = 0.2 + (81 - midi) / 120;                              // decay time constant, low notes longer
    const t = ctx.currentTime;

    const out = new StereoPannerNode(ctx, { pan: Math.max(-1, Math.min(1, pan)) * 0.6 });
    out.connect(input);

    // Percussive envelope (3ms attack, exponential decay) on `tail`, the last node of
    // the source's chain. The source stops once the note is inaudible.
    const strike = (source, gain, tau, tail = source) => {
        const env = new GainNode(ctx, { gain: 0 });
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.003);
        env.gain.setTargetAtTime(0, t + 0.003, tau);
        tail.connect(env).connect(out);
        source.start(t);
        source.stop(t + 0.003 + tau * 5);
        return source;
    };
    const sine = (freq) => new OscillatorNode(ctx, { frequency: freq, detune: (Math.random() - 0.5) * 4 });

    const tick = (gain) => {
        const noise = new AudioBufferSourceNode(ctx, { buffer: click });
        const band = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: Math.min(f * 8, 4000), Q: 1.2 });
        strike(noise, gain, 0.004, noise.connect(band));
    };

    let body;
    if (music.instrument === 1) {
        body = strike(sine(f), peak * 0.8 * loudness(f), ring * 2.5);
        strike(sine(f * 2.756), peak * 0.35 * loudness(f * 2.756), ring * 1.1);
        strike(sine(f * 5.404), peak * 0.18 * hit * loudness(f * 5.404), ring * 0.4);
        tick(peak * 0.15 * hit);
    } else if (music.instrument === 2) {
        const carrier = sine(f);
        const modulator = sine(f);
        const depth = new GainNode(ctx, { gain: 0 });
        depth.gain.setValueAtTime(f * (1 + 2.5 * hit), t);
        depth.gain.setTargetAtTime(f * 0.15, t, 0.12);
        modulator.connect(depth).connect(carrier.frequency);
        modulator.start(t);
        modulator.stop(t + ring * 10);
        body = strike(carrier, peak * 0.7 * loudness(f), ring * 2);
    } else if (music.instrument === 3) {
        const square = new OscillatorNode(ctx, { type: 'square', frequency: f });
        const soften = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: Math.min(f * 6, 6000), Q: 0.7 });
        body = strike(square, peak * 0.3 * loudness(f), ring * 0.8, square.connect(soften));
    } else {
        body = strike(sine(f), peak * loudness(f), ring);
        strike(sine(f * 4), peak * 0.12 * hit * loudness(f * 4), ring * 0.12);
        tick(peak * 0.35 * hit);
    }

    voices++;
    body.onended = () => {
        voices--;
        out.disconnect();
    };
}

// Stereo noise that decays and darkens over time, like a real room.
function room(seconds) {
    const length = Math.round(ctx.sampleRate * seconds);
    const buffer = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: ctx.sampleRate });
    for (let c = 0; c < 2; c++) {
        const data = buffer.getChannelData(c);
        let lowpassed = 0;
        for (let i = 0; i < length; i++) {
            const k = i / length;
            lowpassed += (Math.random() * 2 - 1 - lowpassed) * (0.7 - 0.62 * k);
            data[i] = lowpassed * Math.exp(-6.9 * k);
        }
    }
    return buffer;
}
