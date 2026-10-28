'use client';
import { callAI } from '@/lib/ai/client';
import { NOTE_PROMPTS, tutorSystem } from '@/lib/ai/prompts';
import type { Lecture } from '@/lib/media-db';
import { useAi } from '@/lib/stores/ai';

const RATE = 8000;
/** Six minutes of 8 kHz, 8-bit mono audio is about 2.9 MB, small enough for one request. */
const SEGMENT_SECONDS = 360;

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** A small WAV file (8-bit, mono) from samples in -1..1, with the volume evened out for clearer speech. */
function wav(samples: Float32Array) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0.01 ? 0.95 / peak : 1;
  const out = new Uint8Array(44 + samples.length);
  const v = new DataView(out.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, samples.length, true);
  for (let i = 0; i < samples.length; i++) out[44 + i] = Math.max(0, Math.min(255, Math.round((samples[i] * gain + 1) * 127.5)));
  return toBase64(out);
}

/** Split a recording into small speech-quality WAV pieces the AI can listen to. */
export async function audioSegments(blob: Blob) {
  const ctx = new AudioContext();
  let audio: AudioBuffer;
  try {
    audio = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const mono = (await off.startRendering()).getChannelData(0);
  const step = SEGMENT_SECONDS * RATE;
  const out: string[] = [];
  for (let i = 0; i < mono.length; i += step) out.push(wav(mono.subarray(i, i + step)));
  return out;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Listen to a lecture, write a transcript, then turn it into study notes. */
export async function lectureNotes(l: Lecture, onProgress: (text: string) => void) {
  onProgress('Preparing the audio');
  const parts = await audioSegments(l.blob);
  const transcript: string[] = [];
  for (const [i, data] of parts.entries()) {
    onProgress(`Listening: part ${i + 1} of ${parts.length}`);
    const text = await callAI({
      provider: 'gemini',
      tier: 'fast',
      maxTokens: 6000,
      system: 'You transcribe university lecture recordings. Write what the speaker says as clean plain text in paragraphs. Leave out filler words and repeated false starts. Do not summarize, add headings or comment. Write math the way it is spoken, with symbols where clear (for example "x squared" as x^2). If a part is silent or not speech, write nothing.',
      messages: [{ role: 'user', content: [{ type: 'audio', mediaType: 'audio/wav', data }, { type: 'text', text: `Part ${i + 1} of ${parts.length}${l.course ? ` of a ${l.course} lecture` : ''}. Transcribe it.` }] }],
    });
    transcript.push(text.trim());
  }
  const full = transcript.filter(Boolean).join('\n\n');
  if (!full) throw new Error('The recording did not have any speech the AI could hear.');
  onProgress('Writing notes');
  const marks = l.marks.length ? `\n\nThe student marked these moments as important (time into the lecture): ${l.marks.map((m) => `${clock(m.t)} ${m.label}`).join('; ')}. Give those parts extra attention.` : '';
  const notes = await callAI({
    tier: 'main',
    maxTokens: 5000,
    system: tutorSystem(useAi.getState(), `${NOTE_PROMPTS.notes} After the takeaways add "## Key terms" (a short table) and "## Likely exam questions" (5 questions). Base everything on the lecture transcript; do not add topics the lecture did not cover.`),
    messages: [{ role: 'user', content: `Lecture: ${l.title}${l.course ? ` (${l.course})` : ''}, ${Math.round(l.seconds / 60)} minutes.${marks}\n\nTranscript:\n${full.slice(0, 150_000)}` }],
  });
  return { notes, transcript: full };
}
