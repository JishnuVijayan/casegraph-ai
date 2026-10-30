/** Voice typing lives behind this interface. Sarvam (server-side key) is used when the API has a key; otherwise the browser's own dictation. */
import { api } from '../api';
import { createSarvamProvider } from './sarvam';

export const AUTO_DETECT = { code: 'unknown', label: 'Auto-detect' } as const;
export const SARVAM_EXTRA_LANGUAGES = [
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'od-IN', label: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'ur-IN', label: 'اردو (Urdu)' },
  { code: 'as-IN', label: 'অসমীয়া (Assamese)' },
] as const;
export const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)' },
  { code: 'mr-IN', label: 'मराठी (Marathi)' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)' },
] as const;

export type VoiceHandlers = {
  lang: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};
export interface VoiceSession { stop(): void }
export interface VoiceProvider {
  id: string;
  isSupported(): boolean;
  start(handlers: VoiceHandlers): VoiceSession;
}

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow the microphone in your browser, or type instead.',
  'service-not-allowed': 'Microphone access is blocked. Allow the microphone in your browser, or type instead.',
  'no-speech': 'We did not hear anything. Tap the microphone and try again.',
  'audio-capture': 'No microphone was found on this device.',
  network: 'Voice typing needs an internet connection. You can type instead.',
  'language-not-supported': 'This language is not available for voice typing here. Try another language or type.',
};

export const webSpeechProvider: VoiceProvider = {
  id: 'web-speech',
  isSupported: () => Boolean(ctor()),
  start(handlers) {
    const Ctor = ctor();
    if (!Ctor) { handlers.onError('Voice typing is not available in this browser. Please type, or try Chrome, Edge or Safari.'); handlers.onEnd(); return { stop() {} }; }
    const recognition = new Ctor();
    recognition.lang = handlers.lang === 'unknown' ? 'en-IN' : handlers.lang; recognition.continuous = true; recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) handlers.onFinal(result[0].transcript.trim()); else interim += result[0].transcript;
      }
      handlers.onInterim(interim.trim());
    };
    recognition.onerror = (event) => { if (event.error !== 'aborted') handlers.onError(ERRORS[event.error] ?? 'Voice typing stopped unexpectedly. You can type instead.'); };
    recognition.onend = () => { handlers.onInterim(''); handlers.onEnd(); };
    try { recognition.start(); } catch { handlers.onError('Voice typing could not start. Please try again.'); handlers.onEnd(); }
    return { stop: () => { try { recognition.stop(); } catch { /* already stopped */ } } };
  },
};

let sarvam: VoiceProvider | null = null;
let checked: Promise<void> | null = null;

/** Asks the API once whether server-side voice typing is set up. Safe to call often. */
export function prepareVoice(token: string | undefined): Promise<void> {
  checked ??= api<{ provider: string }>('/voice/status', token)
    .then((r) => { sarvam = r.provider === 'sarvam' ? createSarvamProvider(() => token) : null; })
    .catch(() => { sarvam = null; checked = null; });
  return checked;
}
export function currentVoiceProvider(): VoiceProvider {
  return sarvam?.isSupported() ? sarvam : webSpeechProvider;
}
export function voiceLanguages(providerId: string) {
  return providerId === 'sarvam' ? [AUTO_DETECT, ...VOICE_LANGUAGES, ...SARVAM_EXTRA_LANGUAGES] : [...VOICE_LANGUAGES];
}
