// For a voiceover you made yourself: reads public/voiceover.mp3's exact length and spreads the scenes over it by word count.
// (generate-voiceover.mjs is more exact: it uses ElevenLabs' own word timings.)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTiming, writeTiming } from './timing-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mp3 = join(here, '../public/voiceover.mp3');
const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim());
const lines = readFileSync(join(here, '../voiceover-script.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const words = lines.map((l) => l.split(/\s+/).length), total = words.reduce((a, b) => a + b, 0);
let spoken = 0; const starts = words.map((w) => { const s = (spoken / total) * seconds; spoken += w; return s; });
const timing = buildTiming(starts, seconds);
writeTiming(timing);
console.log(`voiceover.mp3 is ${seconds.toFixed(2)}s. Scene frames:`, timing.scenes.map((s) => `${s.id} ${s.from}+${s.len}`).join(', '));
