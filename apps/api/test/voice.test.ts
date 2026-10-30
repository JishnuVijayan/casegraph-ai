import { transcribe, voiceProvider, LANGUAGE, AUDIO_MIME } from '../src/voice/sarvam';

const clip = Buffer.from('fake-audio');
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('voice typing (Sarvam)', () => {
  const key = process.env.SARVAM_API_KEY;
  afterEach(() => { if (key === undefined) delete process.env.SARVAM_API_KEY; else process.env.SARVAM_API_KEY = key; });

  it('uses browser dictation when no key is set, and says so plainly when asked to transcribe', async () => {
    delete process.env.SARVAM_API_KEY;
    expect(voiceProvider()).toBe('browser');
    await expect(transcribe(clip, 'audio/webm', 'unknown')).rejects.toMatchObject({ userMessage: expect.stringContaining('type instead') });
  });

  it('sends the key as a header, the clip as a file and returns trimmed text', async () => {
    process.env.SARVAM_API_KEY = 'test-key';
    expect(voiceProvider()).toBe('sarvam');
    let seen: { url: string; headers: Record<string, string>; form: FormData } | undefined;
    const fetcher = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string>, form: init.body as FormData };
      return new Response(JSON.stringify({ transcript: '  मुझसे 5000 रुपये ठगे गए  ', language_code: 'hi-IN' }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await transcribe(clip, 'audio/webm;codecs=opus', 'hi-IN', fetcher);
    expect(result).toEqual({ text: 'मुझसे 5000 रुपये ठगे गए', language: 'hi-IN' });
    expect(seen!.url).toBe('https://api.sarvam.ai/speech-to-text');
    expect(seen!.headers['api-subscription-key']).toBe('test-key');
    expect(seen!.form.get('language_code')).toBe('hi-IN');
    expect(seen!.form.get('file')).toBeInstanceOf(Blob);
  });

  it('turns provider failures into plain messages without leaking details', async () => {
    process.env.SARVAM_API_KEY = 'test-key';
    await expect(transcribe(clip, 'audio/webm', 'unknown', reply(429, {}))).rejects.toMatchObject({ status: 429 });
    const failed = await transcribe(clip, 'audio/webm', 'unknown', reply(403, { error: { message: 'invalid key test-key' } })).catch((e) => e);
    expect(failed.status).toBe(503);
    expect(String(failed.userMessage)).not.toContain('test-key');
  });

  it('only accepts known language codes and audio types', () => {
    expect(LANGUAGE.test('ml-IN')).toBe(true); expect(LANGUAGE.test('unknown')).toBe(true);
    expect(LANGUAGE.test('en-US; drop')).toBe(false);
    expect(AUDIO_MIME.test('audio/webm;codecs=opus')).toBe(true); expect(AUDIO_MIME.test('text/html')).toBe(false);
  });
});
