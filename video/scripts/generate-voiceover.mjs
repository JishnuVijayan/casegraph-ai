// Turns voiceover-script.txt into public/voiceover.mp3 with ElevenLabs and aligns every scene to the exact moment its line is spoken.
// Usage: ELEVENLABS_API_KEY=... npm run voiceover        (optional: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_IDS, buildTiming, writeTiming } from './timing-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// The key can be exported in your shell or written as ELEVENLABS_API_KEY=... in the git-ignored .env at the repo root.
const rootEnv = join(here, '../../.env');
if (!process.env.ELEVENLABS_API_KEY && existsSync(rootEnv)) { try { process.loadEnvFile(rootEnv); } catch { /* ignore */ } }
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('Set ELEVENLABS_API_KEY first (never commit it).'); process.exit(1); }
const voice = process.env.ELEVENLABS_VOICE_ID || 'nPczCjzI2devNBz1zQrb'; // "Brian": warm, resonant narrator. List yours with: npm run voices
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

const lines = readFileSync(join(here, '../voiceover-script.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
if (lines.length !== SCENE_IDS.length) { console.error(`voiceover-script.txt needs ${SCENE_IDS.length} lines (one per scene), found ${lines.length}.`); process.exit(1); }
const text = lines.join(' ');

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
  method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, model_id: model, voice_settings: {
    stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.38),        // lower = more expressive and human, higher = steadier
    similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY ?? 0.85),
    style: Number(process.env.ELEVENLABS_STYLE ?? 0.35),                // more style = more drama
    speed: Number(process.env.ELEVENLABS_SPEED ?? 1.0),                 // 0.7 to 1.2
    use_speaker_boost: true,
  } }),
});
if (!res.ok) { console.error(`ElevenLabs said ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1); }
const { audio_base64: audio, alignment } = await res.json();

mkdirSync(join(here, '../public'), { recursive: true });
const target = join(here, '../public/voiceover.mp3');
if (existsSync(target)) copyFileSync(target, join(here, '../public/voiceover.previous.mp3')); // keep the last take so you can compare
writeFileSync(target, Buffer.from(audio, 'base64'));

const startOf = (lineIndex) => alignment.character_start_times_seconds[lines.slice(0, lineIndex).join(' ').length + (lineIndex ? 1 : 0)];
const ends = alignment.character_end_times_seconds;
const seconds = ends[ends.length - 1];
const timing = buildTiming(lines.map((_, i) => startOf(i)), seconds);

// Exact word times for the captions, straight from ElevenLabs' character timings.
const chars = alignment.characters, starts = alignment.character_start_times_seconds, ends2 = alignment.character_end_times_seconds;
const captionWords = []; let wordStart = -1, wordText = '';
const flush = (endIndex) => { if (wordText) { const line = lines.findIndex((_, li) => wordStart < lines.slice(0, li + 1).join(' ').length + 1); captionWords.push({ w: wordText, s: Number(starts[wordStart].toFixed(3)), e: Number(ends2[endIndex].toFixed(3)), line }); } wordText = ''; wordStart = -1; };
chars.forEach((ch, i) => { if (/\s/.test(ch)) flush(i - 1); else { if (wordStart < 0) wordStart = i; wordText += ch; } });
flush(chars.length - 1);
writeFileSync(join(here, '../src/captions.json'), `${JSON.stringify(captionWords, null, 1)}\n`);
writeTiming(timing);
console.log(`Saved public/voiceover.mp3 (${seconds.toFixed(1)}s). Scene frames:`, timing.scenes.map((s) => `${s.id} ${s.from}+${s.len}`).join(', '));
