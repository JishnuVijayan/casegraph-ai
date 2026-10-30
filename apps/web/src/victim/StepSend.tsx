import { useState } from 'react';
import type { Brief } from '../types.v2';
import { CheckIcon, DownloadIcon } from './icons';
import { Modal } from './Modal';
import type { Step } from './Stepper';

type Props = {
  brief: Brief; title: string; onTitle: (t: string) => void; updating: boolean; busy: boolean;
  onDownload: () => void; onGo: (n: Step) => void; onConfirm: () => Promise<void>;
};

/** Step 4. Plain checklist, then one clear Submit. */
export function StepSend({ brief, title, onTitle, updating, busy, onDownload, onGo, onConfirm }: Props) {
  const [sheet, setSheet] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const files = brief.evidence.length;
  const events = brief.timeline.length;
  const answered = brief.questions.filter((q) => q.status !== 'OPEN').length;
  const openQ = brief.questions.length - answered;
  const rows: { ok: boolean; label: string; note?: string; go: Step }[] = [
    { ok: brief.narratives.length > 0, label: 'Your story', note: brief.narratives.length ? undefined : 'Not provided', go: 1 },
    { ok: files > 0, label: files ? `${files} file${files > 1 ? 's' : ''} added` : 'Screenshots or documents', note: files ? undefined : 'Not provided', go: 1 },
    { ok: events > 0, label: events ? `Timeline with ${events} event${events > 1 ? 's' : ''}` : 'Timeline', note: events ? undefined : 'Not provided', go: 3 },
  ];
  if (brief.questions.length) {
    rows.push({ ok: openQ === 0, label: openQ === 0 ? 'Answers to our questions' : `Answers: ${answered} of ${brief.questions.length}`,
      note: openQ === 0 ? undefined : `${openQ} not answered. These will say "not provided".`, go: 2 });
  }
  const ready = brief.narratives.length > 0 || files > 0;

  async function confirm() {
    setSending(true); setError('');
    try { await onConfirm(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send. Please try again.'); setSending(false); }
  }

  return (
    <>
      <div className="v-screen">
        <h1 className="v-h1" tabIndex={-1}>Review and send</h1>
        <p className="v-lead">Here is what will go to the officers. Anything missing will say "not provided". That is fine.</p>

        <ul className="v-check">
          {rows.map((r) => (
            <li key={r.label} className={r.ok ? 'is-ok' : 'is-todo'}>
              <span className="v-check-mark" aria-hidden="true">{r.ok ? <CheckIcon size={15} /> : '–'}</span>
              <span className="v-check-text">
                <span className="sr-only">{r.ok ? 'Included: ' : 'Not included: '}</span>{r.label}
                {r.note && <small>{r.note}</small>}
              </span>
              <button type="button" className="v-link v-check-go" onClick={() => onGo(r.go)}>{r.ok ? 'Change' : r.go === 2 ? 'Answer' : 'Add'}</button>
            </li>
          ))}
        </ul>

        <div className="v-field">
          <label className="cg-label" htmlFor="v-title">Name of your complaint</label>
          <input id="v-title" className="cg-input" value={title} maxLength={140} onChange={(e) => onTitle(e.target.value)} />
          <p className="v-hint">Officers see this first. A short line is enough.</p>
        </div>

        <button type="button" className="cg-btn cg-btn--ghost v-download" disabled={busy || !ready} onClick={onDownload}>
          <DownloadIcon size={18} /> Download my report
        </button>
      </div>

      <div className="v-actionbar">
        <p className="v-action-note" aria-live="polite">{updating ? 'Still updating your report…' : 'After you send, you cannot change it.'}</p>
        <button type="button" className="cg-btn v-primary" disabled={!ready || updating} onClick={() => setSheet(true)}>Submit complaint</button>
      </div>

      {sheet && (
        <Modal title="Send your complaint?" titleId="v-confirm-title" onClose={() => { if (!sending) setSheet(false); }}>
          <h2 id="v-confirm-title">Send your complaint?</h2>
          <p className="v-sheet-text">Officers will review it. You can still download your report.</p>
          <p className="v-sheet-text v-muted">An officer may call you on the mobile number you gave.</p>
          {error && <p className="v-error" role="alert">{error}</p>}
          <div className="v-modal-actions">
            <button type="button" className="cg-btn v-primary" data-autofocus disabled={sending} onClick={() => void confirm()}>{sending ? 'Sending…' : 'Yes, send it'}</button>
            <button type="button" className="cg-btn cg-btn--ghost v-secondary" disabled={sending} onClick={() => setSheet(false)}>Not yet</button>
          </div>
        </Modal>
      )}
    </>
  );
}
