// Lists the voices in your ElevenLabs account so you can pick one: npm run voices
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(here, '../../.env');
if (!process.env.ELEVENLABS_API_KEY && existsSync(rootEnv)) { try { process.loadEnvFile(rootEnv); } catch { /* ignore */ } }
if (!process.env.ELEVENLABS_API_KEY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1); }
const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
if (!res.ok) { console.error(`ElevenLabs said ${res.status}: ${(await res.text()).slice(0, 200)}`); process.exit(1); }
const { voices } = await res.json();
for (const v of voices) {
  const l = v.labels ?? {};
  console.log(`${v.voice_id}  ${v.name.padEnd(22)} ${[l.gender, l.age, l.accent, l.use_case, l.descriptive].filter(Boolean).join(', ')}`);
}
