import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSession } from '../victim/session';
import { currentVoiceProvider, prepareVoice, voiceLanguages, type VoiceSession } from './index';

/** Live dictation. `onFinal` receives each finished phrase; `interim` is the in-progress phrase. */
export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [providerId, setProviderId] = useState(() => currentVoiceProvider().id);
  const session = useRef<VoiceSession | null>(null);
  const finalRef = useRef(onFinal);
  useEffect(() => { finalRef.current = onFinal; });
  useEffect(() => { let live = true; void prepareVoice(loadSession()?.token).then(() => { if (live) setProviderId(currentVoiceProvider().id); }); return () => { live = false; }; }, []);
  const supported = currentVoiceProvider().isSupported();

  const stop = useCallback(() => { session.current?.stop(); }, []);
  const start = useCallback((lang: string) => {
    setError('');
    const provider = currentVoiceProvider();
    if (!provider.isSupported()) { setError('Voice typing is not available in this browser. Please type, or try Chrome, Edge or Safari.'); return; }
    setListening(true);
    session.current = provider.start({
      lang,
      onInterim: setInterim,
      onFinal: (t) => { if (t) finalRef.current(t); },
      onError: (m) => setError(m),
      onEnd: () => { setListening(false); setInterim(''); session.current = null; },
    });
  }, []);
  useEffect(() => () => session.current?.stop(), []);
  return { supported, listening, interim, error, start, stop, clearError: () => setError(''), languages: voiceLanguages(providerId), providerId };
}
