import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const status = (provider: string) => vi.fn(async () => new Response(JSON.stringify({ data: { provider }, requestId: 'r' }), { status: 200 }));

describe('voice provider choice', () => {
  it('uses server-side voice typing when the API has a speech key and the browser can record', async () => {
    vi.stubGlobal('fetch', status('sarvam'));
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
    const voice = await import('./index');
    await voice.prepareVoice('token');
    expect(voice.currentVoiceProvider().id).toBe('sarvam');
    expect(voice.voiceLanguages('sarvam')[0].code).toBe('unknown');
  });

  it('falls back to the browser dictation when no key is set or the check fails', async () => {
    vi.stubGlobal('fetch', status('browser'));
    let voice = await import('./index');
    await voice.prepareVoice('token');
    expect(voice.currentVoiceProvider().id).toBe('web-speech');
    expect(voice.voiceLanguages('web-speech').some((l) => l.code === 'unknown')).toBe(false);
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    voice = await import('./index');
    await voice.prepareVoice('token');
    expect(voice.currentVoiceProvider().id).toBe('web-speech');
  });
});
