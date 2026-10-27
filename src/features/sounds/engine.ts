'use client';
/**
 * Ambient focus sounds, generated in the browser with the Web Audio API.
 * Nothing is downloaded: each sound is shaped from noise with filters and
 * slow modulation, so it can play for hours without an audible loop.
 */

export type SoundId = 'balanced' | 'bright' | 'dark' | 'rain' | 'ocean' | 'stream' | 'fire';

export const SOUNDS: { id: SoundId; label: string; note: string }[] = [
  { id: 'rain', label: 'Rain', note: 'Steady rainfall with soft drops. Good at covering nearby voices.' },
  { id: 'ocean', label: 'Ocean', note: 'Slow waves that rise and fall about every ten seconds.' },
  { id: 'stream', label: 'Stream', note: 'Moving water with a light, bubbling texture.' },
  { id: 'fire', label: 'Fireplace', note: 'A low rumble with occasional crackles.' },
  { id: 'balanced', label: 'Balanced noise', note: 'Pink noise. Even across low and high pitches.' },
  { id: 'bright', label: 'Bright noise', note: 'White noise. More hiss, masks sharp sounds best.' },
  { id: 'dark', label: 'Dark noise', note: 'Brown noise. Deep and soft, like a distant rumble.' },
];

type Graph = { out: GainNode; stop: () => void };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: { id: SoundId; graph: Graph } | null = null;
const buffers = new Map<string, AudioBuffer>();

const FADE = 1.2;
const SECONDS = 12;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return { ctx, master: master! };
}

/** A stereo buffer filled by `fill(channelData, channel)`, cached by key. */
function buffer(key: string, fill: (d: Float32Array, ch: number, rate: number) => void) {
  const { ctx } = audio();
  const hit = buffers.get(key);
  if (hit) return hit;
  const b = ctx.createBuffer(2, ctx.sampleRate * SECONDS, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) fill(b.getChannelData(ch), ch, ctx.sampleRate);
  // Cross-fade the last half second into the start so the loop point is silent.
  const n = Math.floor(ctx.sampleRate * 0.5);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] = d[i] * t + d[d.length - n + i] * (1 - t);
    }
  }
  const looped = ctx.createBuffer(2, b.length - n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) looped.copyToChannel(b.getChannelData(ch).subarray(0, b.length - n), ch);
  buffers.set(key, looped);
  return looped;
}

const white = () => buffer('white', (d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });

const pink = () =>
  buffer('pink', (d) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  });

const brown = () =>
  buffer('brown', (d) => {
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
  });

/** Sparse short noise bursts: raindrops, or crackles when `sharp` is set. */
const bursts = (key: string, perSecond: number, sharp: boolean) =>
  buffer(key, (d, _ch, rate) => {
    const count = Math.floor(perSecond * SECONDS);
    for (let k = 0; k < count; k++) {
      const start = Math.floor(Math.random() * d.length);
      const len = Math.floor(rate * (sharp ? 0.004 + Math.random() * 0.02 : 0.002 + Math.random() * 0.006));
      const amp = sharp ? 0.3 + Math.random() * 0.7 : 0.15 + Math.random() * 0.5;
      for (let i = 0; i < len && start + i < d.length; i++) d[start + i] += (Math.random() * 2 - 1) * amp * Math.exp((-6 * i) / len);
    }
  });

/** A smooth random control signal between 0 and 1, for babbling water. */
const wobble = () =>
  buffer('wobble', (d, _ch, rate) => {
    let v = 0.5, target = 0.5;
    const step = Math.floor(rate * 0.06);
    for (let i = 0; i < d.length; i++) {
      if (i % step === 0) target = Math.random();
      v += (target - v) * 0.0015;
      d[i] = v;
    }
  });

function source(buf: AudioBuffer, offset = Math.random() * SECONDS * 0.8) {
  const { ctx } = audio();
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start(0, offset);
  return s;
}

function filter(type: BiquadFilterType, frequency: number, Q = 0.7) {
  const f = audio().ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  return f;
}

function gain(value: number) {
  const g = audio().ctx.createGain();
  g.gain.value = value;
  return g;
}

function lfo(rate: number, depth: number, target: AudioParam) {
  const o = audio().ctx.createOscillator();
  o.frequency.value = rate;
  const d = gain(depth);
  o.connect(d).connect(target);
  o.start();
  return o;
}

function build(id: SoundId): Graph {
  const out = gain(0);
  const nodes: (AudioScheduledSourceNode)[] = [];
  const chain = (first: AudioNode, ...rest: AudioNode[]) => rest.reduce((a, b) => a.connect(b), first).connect(out);

  if (id === 'bright') { const s = source(white()); nodes.push(s); chain(s, gain(0.22)); }
  if (id === 'balanced') { const s = source(pink()); nodes.push(s); chain(s, gain(0.5)); }
  if (id === 'dark') { const s = source(brown()); nodes.push(s); chain(s, filter('lowpass', 900), gain(0.9)); }

  if (id === 'rain') {
    const hiss = source(white());
    const body = source(pink());
    const drops = source(bursts('drops', 90, false));
    nodes.push(hiss, body, drops);
    chain(hiss, filter('highpass', 1200), filter('lowpass', 9000), gain(0.07));
    chain(body, filter('bandpass', 1400, 0.5), gain(0.35));
    chain(drops, filter('bandpass', 3200, 1.2), gain(0.5));
  }

  if (id === 'ocean') {
    const deep = source(brown());
    const foam = source(pink());
    const lp = filter('lowpass', 700);
    const swell = gain(0.55);
    const foamGain = gain(0.06);
    nodes.push(deep, foam);
    deep.connect(lp).connect(swell).connect(out);
    foam.connect(filter('highpass', 1500)).connect(foamGain).connect(out);
    // One wave about every ten seconds: volume, brightness and foam rise together.
    nodes.push(lfo(0.1, 0.4, swell.gain), lfo(0.1, 450, lp.frequency), lfo(0.1, 0.05, foamGain.gain));
  }

  if (id === 'stream') {
    const flow = source(pink());
    const bubbles = source(white());
    const control = source(wobble());
    const bubbleGain = gain(0.02);
    nodes.push(flow, bubbles, control);
    chain(flow, filter('bandpass', 900, 0.6), gain(0.45));
    bubbles.connect(filter('bandpass', 2600, 2.5)).connect(bubbleGain).connect(out);
    control.connect(gain(0.09)).connect(bubbleGain.gain);
  }

  if (id === 'fire') {
    const rumble = source(brown());
    const crackle = source(bursts('crackle', 14, true));
    const flicker = gain(0.7);
    nodes.push(rumble, crackle);
    rumble.connect(filter('lowpass', 500)).connect(flicker).connect(out);
    chain(crackle, filter('highpass', 1800), gain(0.35));
    nodes.push(lfo(0.37, 0.15, flicker.gain));
  }

  return {
    out,
    stop: () => {
      for (const n of nodes) {
        try { n.stop(); } catch { /* already stopped */ }
      }
      out.disconnect();
    },
  };
}

export async function playSound(id: SoundId, volume: number) {
  const { ctx, master } = audio();
  master.gain.value = curve(volume);
  if (ctx.state === 'suspended') await ctx.resume();
  if (current?.id === id) return;
  stopSound();
  const graph = build(id);
  graph.out.connect(master);
  const now = ctx.currentTime;
  graph.out.gain.setValueAtTime(0, now);
  graph.out.gain.linearRampToValueAtTime(1, now + FADE);
  current = { id, graph };
}

export function stopSound() {
  if (!ctx || !current) return;
  const { graph } = current;
  const now = ctx.currentTime;
  graph.out.gain.cancelScheduledValues(now);
  graph.out.gain.setValueAtTime(graph.out.gain.value, now);
  graph.out.gain.linearRampToValueAtTime(0, now + FADE);
  setTimeout(graph.stop, FADE * 1000 + 100);
  current = null;
}

/** Slider 0 to 1 mapped on a squared curve so the low end is usable. */
const curve = (v: number) => Math.max(0, Math.min(1, v)) ** 2;

export function setSoundVolume(v: number) {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(curve(v), ctx.currentTime, 0.05);
}
