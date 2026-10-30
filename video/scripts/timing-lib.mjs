import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const TIMING_FILE = join(here, '../src/timing.json');
export const FPS = 30, TOTAL = 900, LEAD = 4; // pictures arrive 4 frames before the words
export const SCENE_IDS = ['hook', 'problem', 'tell', 'ai', 'network', 'cta'];

/** startSeconds[i] = when the narration of scene i begins. Returns scene frames that cover exactly 0..TOTAL. */
export function buildTiming(startSeconds, audioSeconds) {
  if (audioSeconds > TOTAL / FPS) throw new Error(`The narration is ${audioSeconds.toFixed(1)}s but the video is ${TOTAL / FPS}s. Shorten voiceover-script.txt.`);
  const starts = startSeconds.map((s, i) => (i === 0 ? 0 : Math.max(0, Math.round(s * FPS) - LEAD)));
  for (let i = 1; i < starts.length; i += 1) starts[i] = Math.max(starts[i], starts[i - 1] + 45); // every scene stays on screen at least 1.5s
  const scenes = SCENE_IDS.map((id, i) => ({ id, from: starts[i], len: (i + 1 < starts.length ? starts[i + 1] : TOTAL) - starts[i] }));
  if (scenes.some((s) => s.len < 30 || s.from + s.len > TOTAL)) throw new Error('Scene timings do not fit in the video. Shorten the script.');
  return { fps: FPS, total: TOTAL, voiceover: true, audioSeconds: Number(audioSeconds.toFixed(2)), scenes };
}
export const writeTiming = (timing) => writeFileSync(TIMING_FILE, `${JSON.stringify(timing, null, 2)}\n`);
