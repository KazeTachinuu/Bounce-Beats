// ---- music: scale, key, mix ----
// Lines play notes of the chosen scale over three octaves. The mix sets each note's
// level in LEVELS steps of 4 dB (0 = muted). Scale, key and mix belong to the song
// and travel in the share link; the master volume is the listener's own.

export const SCALES = [
    ['Pentatonic', [0, 3, 5, 7, 10]],
    ['Major', [0, 2, 4, 5, 7, 9, 11]],
    ['Minor', [0, 2, 3, 5, 7, 8, 10]],
    ['Blues', [0, 3, 5, 6, 7, 10]],
    ['Japanese', [0, 2, 3, 7, 8]],
];
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const LEVELS = 8;
export const DEFAULT_SCALE = 0;
export const DEFAULT_KEY = 9; // A

export const music = { scale: DEFAULT_SCALE, key: DEFAULT_KEY, levels: [], volume: 1 };
export let NOTES = [];  // [name, midi], low to high

export function setScale(scale, key) {
    Object.assign(music, { scale, key });
    const root = 40 + ((key - 4 + 12) % 12);  // lowest note between E2 and D#3
    const steps = SCALES[scale][1];
    const midis = [];
    for (let octave = 0; octave < 3; octave++) for (const step of steps) midis.push(root + 12 * octave + step);
    midis.push(root + 36);
    NOTES = midis.map((midi) => [KEYS[midi % 12] + (Math.floor(midi / 12) - 1), midi]);
    music.levels = NOTES.map((_, i) => music.levels[i] ?? LEVELS);
}
setScale(DEFAULT_SCALE, DEFAULT_KEY);

const levelGain = (level) => (level ? 10 ** (((level - LEVELS) * 4) / 20) : 0);

export function setVolume(volume) {
    music.volume = volume;
    master?.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
}

const LONGEST_LINE = 1200;      // px, plays the lowest note
const LISTENING_PHON = 70;      // assumed listening level for loudness compensation
const MAX_VOICES = 16;
const VOLUME = 0.1;

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Like a string or a bar: frequency is inversely proportional to length.
// The result is snapped to the nearest note of the scale.
export function noteFor(length) {
    const midi = 69 + 12 * Math.log2((hz(NOTES[0][1]) * LONGEST_LINE) / Math.max(length, 1) / 440);
    let best = NOTES[0];
    for (const note of NOTES) if (Math.abs(note[1] - midi) < Math.abs(best[1] - midi)) best = note;
    return best;
}

// The exact line length that plays `note` (the inverse of noteFor).
export const lengthFor = (note) => (LONGEST_LINE * hz(NOTES[0][1])) / hz(note[1]);

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

let ctx, master, input, click, voices = 0;

// Must run inside a user gesture: browsers keep audio locked until then.
export function unlock() {
    if (ctx) return ctx.resume();
    ctx = new AudioContext({ latencyHint: 'interactive' });

    const limiter = new DynamicsCompressorNode(ctx, { threshold: -14, knee: 8, ratio: 6, attack: 0.003, release: 0.2 });
    master = new GainNode(ctx, { gain: music.volume });
    limiter.connect(master).connect(ctx.destination);

    // Gentle lowpass for a warm, lo-fi top end.
    input = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5200, Q: 0.5 });
    input.connect(limiter);

    click = new AudioBuffer({ length: Math.round(ctx.sampleRate * 0.03), sampleRate: ctx.sampleRate });
    click.getChannelData(0).forEach((_, i, data) => { data[i] = Math.random() * 2 - 1; });

    const preDelay = new DelayNode(ctx, { delayTime: 0.018 });
    const reverb = new ConvolverNode(ctx, { buffer: room(2.4) });
    input.connect(preDelay).connect(reverb).connect(new GainNode(ctx, { gain: 0.3 })).connect(limiter);
}

// A soft mallet note, modelled on a marimba bar: a sine fundamental, the bar's
// first overtone (tuned two octaves up, so it stays musical), and a short
// filtered-noise strike. Each partial is loudness-compensated at its own frequency.
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

    const body = strike(sine(f), peak * loudness(f), ring);
    strike(sine(f * 4), peak * 0.12 * hit * loudness(f * 4), ring * 0.12);
    const noise = new AudioBufferSourceNode(ctx, { buffer: click });
    const band = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: Math.min(f * 8, 4000), Q: 1.2 });
    strike(noise, peak * 0.35 * hit, 0.004, noise.connect(band));

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
