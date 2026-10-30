import { useEffect, useRef, useState } from 'react';
import type { Question } from '../types.v2';
import { VOICE_LANGUAGES } from '../voice';
import { useDictation } from '../voice/useDictation';
import { MicIcon, StopIcon } from './icons';
import { useToast } from './toast';

function savedLang() { try { return localStorage.getItem('cg.voiceLang') || VOICE_LANGUAGES[0].code; } catch { return VOICE_LANGUAGES[0].code; } }

type Props = {
  questions: Question[]; onAnswer: (id: string, text: string) => Promise<void>;
  onDone: () => void; onSkip: () => void; onBack: () => void;
};

/** Step 3. One question per screen. */
export function StepQuestions({ questions, onAnswer, onDone, onSkip, onBack }: Props) {
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const dictation = useDictation((p) => setText((c) => (c ? `${c} ` : '') + p));
  const head = useRef<HTMLHeadingElement>(null);
  const q = questions[index];
  const total = questions.length;

  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [index]);

  if (!q) {
    return (
      <>
        <div className="v-screen">
          <h1 className="v-h1" tabIndex={-1}>You are all set here</h1>
          <p className="v-lead">There is nothing more we need to ask right now.</p>
        </div>
        <div className="v-actionbar v-actionbar--pair">
          <button type="button" className="cg-btn cg-btn--ghost v-secondary" onClick={onBack}>Back</button>
          <button type="button" className="cg-btn v-primary" onClick={onDone}>Continue</button>
        </div>
      </>
    );
  }

  async function send(value: string) {
    const answer = value.trim(); if (!answer || busy) return;
    dictation.stop(); setBusy(true);
    try {
      await onAnswer(q.id, answer);
      setText('');
      if (index + 1 >= total) onDone(); else setIndex(index + 1);
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save your answer. Please try again.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="v-screen" key={q.id}>
        <p className="v-qcount" id="v-qcount">Question {index + 1} of {total}</p>
        <div className="v-bar-track v-qbar" role="progressbar" aria-labelledby="v-qcount" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1}>
          <span style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <h1 className="v-h1 v-qtitle" ref={head} tabIndex={-1}>{q.prompt}</h1>
        {q.why && <p className="v-why">Why we ask: {q.why}</p>}

        {q.options && q.options.length > 0 && (
          <div className="v-opts" role="group" aria-label="Quick answers">
            {q.options.map((o) => <button key={o} type="button" className="v-opt" disabled={busy} onClick={() => void send(o)}>{o}</button>)}
          </div>
        )}

        <label className="cg-label v-alabel" htmlFor="v-answer">{q.options?.length ? 'Or write your own answer' : 'Your answer'}</label>
        <div className="v-answer-box">
          <textarea id="v-answer" className="cg-textarea v-answer" rows={3} maxLength={500} disabled={busy}
            value={text + (dictation.interim ? ` ${dictation.interim}` : '')} onChange={(e) => setText(e.target.value)} />
          <button type="button" className={`v-mic-round${dictation.listening ? ' is-on' : ''}`} aria-pressed={dictation.listening}
            aria-label={dictation.listening ? 'Stop speaking' : 'Speak your answer'}
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start(savedLang()))}>
            {dictation.listening ? <StopIcon size={22} /> : <MicIcon size={22} />}
          </button>
        </div>
        {dictation.error && <p className="v-error" role="alert">{dictation.error}</p>}
        <p className="v-fix">
          <button type="button" className="v-link" disabled={busy} onClick={onSkip}>Skip for now</button>
        </p>
      </div>
      <div className="v-actionbar v-actionbar--pair">
        <button type="button" className="cg-btn cg-btn--ghost v-secondary" disabled={busy} onClick={() => void send('UNKNOWN')}>I don't know</button>
        <button type="button" className="cg-btn v-primary" disabled={busy || !text.trim()} onClick={() => void send(text)}>
          {busy ? 'Saving…' : index + 1 >= total ? 'Save and finish' : 'Save and next'}
        </button>
      </div>
    </>
  );
}
