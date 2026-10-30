// Turns narration/script.srt into a natural ElevenLabs voice track.
//   node narration/generate.mjs --dry        show the segments and the credit cost, call nothing
//   node narration/generate.mjs              generate (clips are cached, so re-running costs nothing)
//   node narration/generate.mjs --force      regenerate every clip
// Output (narration/out/):
//   narration-timed.mp3        every sentence placed at its timestamp (drop it under your screen recording)
//   narration-continuous.mp3   the same sentences back to back with short natural pauses
// Settings (environment variables):
//   ELEVENLABS_API_KEY  (or put it in the git-ignored .env at the repo root)
//   ELEVENLABS_VOICE_ID (default Brian, a warm resonant male narrator)   ELEVENLABS_MODEL (default eleven_multilingual_v2)
//   ELEVENLABS_STABILITY (0.5)  ELEVENLABS_STYLE (0.2)  ELEVENLABS_SPEED (0.97)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'out'), CLIPS = join(OUT, 'clips');
const args = new Set(process.argv.slice(2));
const rootEnv = join(here, '../.env');
if (!process.env.ELEVENLABS_API_KEY && existsSync(rootEnv)) { try { process.loadEnvFile(rootEnv); } catch { /* ignore */ } }

// ── 1. Read the script ────────────────────────────────────────────────────────
const sec = (t) => { const [h, m, rest] = t.split(':'); const [s, ms] = rest.split(','); return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000; };
const segments = readFileSync(join(here, 'script.srt'), 'utf8').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((block) => {
  const [head, ...text] = block.split('\n');
  const m = /^(\d\d:\d\d:\d\d,\d{3})\s*-->\s*(\d\d:\d\d:\d\d,\d{3})/.exec(head);
  if (!m) throw new Error(`Cannot read the timing line: ${head}`);
  return { start: sec(m[1]), end: sec(m[2]), text: text.join(' ').replace(/\s+/g, ' ').trim() };
});
// Said out loud the way a narrator would say them (the on-screen script is untouched).
const SAY = [[/\bOCR\b/g, 'O.C.R.'], [/\bAI\b/g, 'A.I.']];
const spoken = (t) => SAY.reduce((s, [re, to]) => s.replace(re, to), t);
const chars = segments.reduce((n, s) => n + spoken(s.text).length, 0);
console.log(`${segments.length} sentences, ${chars} characters (about ${chars} ElevenLabs credits).`);
if (args.has('--dry')) { segments.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}  ${s.start.toFixed(2)}s-${s.end.toFixed(2)}s  ${s.text.slice(0, 70)}`)); process.exit(0); }

// ── 2. Make one clip per sentence (cached) ────────────────────────────────────
mkdirSync(CLIPS, { recursive: true });
const selftest = args.has('--selftest');
const key = process.env.ELEVENLABS_API_KEY;
if (!key && !selftest) { console.error('Set ELEVENLABS_API_KEY first (export it, or add it to .env). Nothing was sent.'); process.exit(1); }
const voice = process.env.ELEVENLABS_VOICE_ID || 'nPczCjzI2devNBz1zQrb'; // Brian
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const settings = {
  stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.5), similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY ?? 0.8),
  style: Number(process.env.ELEVENLABS_STYLE ?? 0.2), speed: Number(process.env.ELEVENLABS_SPEED ?? 0.97), use_speaker_boost: true,
};
const tag = createHash('sha1').update(JSON.stringify({ voice, model, settings })).digest('hex').slice(0, 8);
const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

for (const [i, s] of segments.entries()) {
  const text = spoken(s.text);
  const file = join(CLIPS, `${String(i + 1).padStart(2, '0')}-${createHash('sha1').update(text).digest('hex').slice(0, 8)}-${selftest ? 'test' : tag}.mp3`);
  s.file = file;
  if (existsSync(file) && !args.has('--force')) continue;
  if (selftest) { // a tone as long as the sentence would roughly take to say, to test the timing without calling the API
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `sine=f=${180 + (i % 5) * 30}:d=${(text.length / 15).toFixed(2)}`, file]);
    continue;
  }
  // The neighbouring sentences are sent as context so the delivery flows from one clip to the next instead of resetting.
  const body = { text, model_id: model, voice_settings: settings, previous_text: i ? spoken(segments[i - 1].text) : undefined, next_text: i + 1 < segments.length ? spoken(segments[i + 1].text) : undefined };
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { console.error(`Sentence ${i + 1}: ElevenLabs said ${res.status}: ${(await res.text()).slice(0, 300)}\nClips made so far are kept; run the command again to continue.`); process.exit(1); }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`made ${i + 1}/${segments.length}`);
}

// ── 3. Fit each clip into its slot and mix them onto the timeline ─────────────
const fitted = [];
segments.forEach((s, i) => {
  const slot = (i + 1 < segments.length ? segments[i + 1].start : s.end + 5) - s.start;
  const dur = probe(s.file);
  let tempo = 1;
  if (dur > slot - 0.12) { tempo = dur / (slot - 0.12); }
  if (tempo > 1.18) console.warn(`Sentence ${i + 1} is ${dur.toFixed(1)}s but its slot is ${slot.toFixed(1)}s; it will run a little into the next one. Shorten that line or raise the slot.`);
  fitted.push({ ...s, dur, tempo: Math.min(1.18, Math.max(1, tempo)) });
});
const mix = (inputs, filters, out, extra = '') => {
  const graph = `${filters};${inputs.map((_, i) => `[a${i}]`).join('')}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0${extra}[out]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-map', '[out]', '-ar', '44100', '-ac', '2', '-b:a', '192k', out]);
};
const LOUD = ',loudnorm=I=-16:TP=-1.5:LRA=11';
// Timed: each sentence starts at its own timestamp.
mix(fitted.map((s) => s.file), fitted.map((s, i) => `[${i}]atempo=${s.tempo.toFixed(4)},adelay=${Math.round(s.start * 1000)}|${Math.round(s.start * 1000)}[a${i}]`).join(';'), join(OUT, 'narration-timed.mp3'), LOUD);
// Continuous: back to back with a short, natural breath between sentences.
let t = 0; const delays = fitted.map((s) => { const at = t; t += s.dur / s.tempo + (/[,]$/.test(s.text) ? 0.18 : 0.45); return at; });
mix(fitted.map((s) => s.file), fitted.map((s, i) => `[${i}]atempo=${s.tempo.toFixed(4)},adelay=${Math.round(delays[i] * 1000)}|${Math.round(delays[i] * 1000)}[a${i}]`).join(';'), join(OUT, 'narration-continuous.mp3'), LOUD);
const total = (f) => probe(join(OUT, f)).toFixed(1);
console.log(`\nDone.\n  ${join(OUT, 'narration-timed.mp3')}  (${total('narration-timed.mp3')} s, matches your timestamps)\n  ${join(OUT, 'narration-continuous.mp3')}  (${total('narration-continuous.mp3')} s, no gaps)`);
