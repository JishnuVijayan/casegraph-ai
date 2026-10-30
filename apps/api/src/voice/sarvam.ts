import { PlainError } from '../common/http';

const ENDPOINT = 'https://api.sarvam.ai/speech-to-text';
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const AUDIO_MIME = /^audio\/(webm|ogg|wav|x-wav|wave|mpeg|mp3|mp4|x-m4a|aac|flac)(;.*)?$/i;
export const LANGUAGE = /^(unknown|[a-z]{2,3}-IN)$/;

export const sarvamKey = () => (process.env.SARVAM_API_KEY ?? '').trim();
export const voiceProvider = () => (sarvamKey() ? 'sarvam' as const : 'browser' as const);

type Fetcher = typeof fetch;

/** Sends one short clip (under about 30 seconds) to Sarvam speech-to-text. The key never leaves the server. */
export async function transcribe(audio: Buffer, mime: string, language: string, fetcher: Fetcher = fetch): Promise<{ text: string; language: string | null }> {
  const key = sarvamKey();
  if (!key) throw new PlainError(503, 'Voice typing is not set up yet. You can type instead.', 'VOICE_UNAVAILABLE');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime.split(';')[0] }), `clip.${mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('wav') ? 'wav' : 'webm'}`);
  form.append('model', process.env.SARVAM_STT_MODEL || 'saaras:v4');
  form.append('language_code', language);
  let response: Response;
  try { response = await fetcher(ENDPOINT, { method: 'POST', headers: { 'api-subscription-key': key }, body: form, signal: AbortSignal.timeout(25000), redirect: 'error' }); }
  catch { throw new PlainError(503, 'Voice typing could not reach the speech service. Please try again or type instead.', 'VOICE_UNAVAILABLE'); }
  if (response.status === 429) throw new PlainError(429, 'Voice typing is busy. Please wait a moment and try again.', 'VOICE_BUSY');
  if (!response.ok) throw new PlainError(503, 'Voice typing is not available right now. You can type instead.', 'VOICE_UNAVAILABLE');
  const body = await response.json().catch(() => null) as { transcript?: unknown; language_code?: unknown } | null;
  const text = typeof body?.transcript === 'string' ? body.transcript.trim().slice(0, 4000) : '';
  return { text, language: typeof body?.language_code === 'string' ? body.language_code : null };
}
