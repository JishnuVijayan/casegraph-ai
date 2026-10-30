import { api } from '../api';
import type { VoiceHandlers, VoiceProvider, VoiceSession } from './index';

const SEGMENT_MS = 7000;
const MIN_BYTES = 1500;

function recorderMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) ?? '';
}

/**
 * Speech to text through our own API (which holds the Sarvam key). Records the microphone in short clips
 * and sends each one as soon as it ends, so words appear a few seconds after they are spoken, in order.
 */
export function createSarvamProvider(getToken: () => string | undefined): VoiceProvider {
  return {
    id: 'sarvam',
    isSupported: () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined',
    start(handlers: VoiceHandlers): VoiceSession {
      let stream: MediaStream | null = null;
      let stopped = false;
      let queue: Promise<void> = Promise.resolve();
      let pending = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let recorder: MediaRecorder | null = null;
      let finished = false;

      const finish = () => { if (finished) return; finished = true; handlers.onInterim(''); handlers.onEnd(); };
      const release = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };

      const send = (blob: Blob) => {
        pending += 1; handlers.onInterim('…');
        queue = queue.then(async () => {
          try {
            const form = new FormData();
            form.append('file', blob, 'clip');
            const result = await api<{ text: string }>(`/voice/transcribe?lang=${encodeURIComponent(handlers.lang)}`, getToken(), form, 'POST');
            if (result.text) handlers.onFinal(result.text);
          } catch (error) {
            handlers.onError(error instanceof Error && error.message ? error.message : 'Voice typing stopped. You can type instead.');
          } finally {
            pending -= 1;
            if (pending === 0) handlers.onInterim('');
            if (stopped && pending === 0) finish();
          }
        });
      };

      const record = () => {
        if (!stream || stopped) return;
        const mimeType = recorderMime();
        const chunks: Blob[] = [];
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder?.mimeType || mimeType || 'audio/webm' });
          if (blob.size >= MIN_BYTES) send(blob);
          if (stopped) { release(); if (pending === 0) finish(); } else record();
        };
        recorder.start();
        timer = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop(); }, SEGMENT_MS);
      };

      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
        .then((s) => { if (stopped) { s.getTracks().forEach((t) => t.stop()); finish(); return; } stream = s; record(); })
        .catch((error: Error) => {
          handlers.onError(error.name === 'NotFoundError' ? 'No microphone was found on this device.'
            : 'Microphone access is blocked. Allow the microphone in your browser, or type instead.');
          finish();
        });

      return {
        stop() {
          if (stopped) return;
          stopped = true; clearTimeout(timer);
          if (recorder?.state === 'recording') recorder.stop(); else { release(); if (pending === 0) finish(); }
        },
      };
    },
  };
}
