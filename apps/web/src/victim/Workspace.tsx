import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { downloadFile, errorMessage, fetchBlob } from '../api';
import type { Brief, Question, Session } from '../types.v2';
import { HelpStrip } from './HelpStrip';
import { CheckIcon, ChevronLeft } from './icons';
import { StepCheck } from './StepCheck';
import { StepQuestions } from './StepQuestions';
import { StepSend } from './StepSend';
import { StepTell, type Draft } from './StepTell';
import { AnalysisProgress } from './StepCheck';
import { Stepper, type Step } from './Stepper';
import { Submitted } from './Submitted';
import { useToast } from './toast';
import { useCase } from './useCase';

const draftKey = (id: string) => `cg.draft.${id}`;
function loadDraft(id: string): Draft {
  try { const t = localStorage.getItem(draftKey(id)); if (t) return { text: t, voice: false }; } catch { /* ignore */ }
  return { text: '', voice: false };
}
const hasAnalysis = (b: Brief) => b.analysis.state === 'READY' || !!b.summary || b.timeline.length > 0;

export function Workspace({ session, onAuthLost }: { session: Session; onAuthLost: () => void }) {
  const { caseId = '' } = useParams();
  const toast = useToast();
  const c = useCase(caseId, session.token, onAuthLost);
  const { brief } = c;
  const [step, setStep] = useState<Step | null>(null);
  const [reached, setReached] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(caseId));
  const [fix, setFix] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  // The questions on screen are frozen when step 2 opens: the list must not change while someone is typing an answer.
  const [qSnap, setQSnap] = useState<Question[] | null>(null);
  const answeredAny = useRef(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const autoRan = useRef(false);

  useEffect(() => { document.title = brief ? `${brief.reference} — CaseGraph` : 'CaseGraph — report a cyber crime'; }, [brief]);

  // Land on the right step once, when the complaint first loads.
  useEffect(() => {
    if (!brief || step !== null) return;
    const s: Step = hasAnalysis(brief) ? 3 : 1;
    setStep(s); setReached(s); setTitle(brief.title);
  }, [brief, step]);
  // Title follows the AI until the person edits it on the last step.
  useEffect(() => { if (brief && step !== 4) setTitle(brief.title); }, [brief?.title, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave the unsent text on this device.
  useEffect(() => {
    try { if (draft.text.trim()) localStorage.setItem(draftKey(caseId), draft.text); else localStorage.removeItem(draftKey(caseId)); } catch { /* ignore */ }
  }, [draft.text, caseId]);

  // Move focus to the new screen's heading, and start at the top.
  useEffect(() => {
    if (step === null) return;
    window.scrollTo({ top: 0 });
    const h = document.querySelector<HTMLElement>('.v-screen h1');
    if (h && !fix) h.focus({ preventScroll: true });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyzing = c.analyzing;
  // Opening the Check step with unread input: start reading once.
  useEffect(() => {
    if (step !== 3) { autoRan.current = false; return; }
    if (!brief || autoRan.current || analyzing || c.analysisError) return;
    if (brief.analysis.state !== 'READY' && (brief.narratives.length || brief.evidence.length)) { autoRan.current = true; c.analyzeNow(); }
  }, [step, brief, analyzing, c.analysisError]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async (): Promise<boolean> => {
    const text = draft.text.trim();
    if (!text) return true;
    try {
      await c.sendNarrative(text, draft.voice ? 'voice' : 'typed');
      setDraft({ text: '', voice: false });
      return true;
    } catch (e) { toast(errorMessage(e), 'error'); return false; }
  }, [draft, c, toast]);

  const go = useCallback(async (n: Step) => {
    if (step === 1 && n !== 1 && !(await flush())) return;
    setFix(false);
    setQSnap(null);
    setStep(n); setReached((r) => (n > r ? n : r));
  }, [step, flush]);

  // Step 2: wait for the AI to finish reading, then freeze the open questions. No questions means straight to Check.
  useEffect(() => {
    if (step !== 2 || qSnap !== null || !brief || analyzing || c.analysisError) return;
    if (brief.analysis.state !== 'READY') return;
    const open = brief.questions.filter((q) => q.status === 'OPEN').slice(0, 5);
    if (open.length) setQSnap(open);
    else { setStep(3); setReached((r) => (r > 3 ? r : 3)); }
  }, [step, qSnap, brief, analyzing, c.analysisError]);

  // After the last answer, read everything once more so answers reach the timeline, then show the Check step.
  const finishQuestions = useCallback(() => {
    if (answeredAny.current) { answeredAny.current = false; c.analyzeNow(); }
    void go(3);
  }, [c, go]);

  const path = `/cases/${encodeURIComponent(caseId)}/report.html`;
  const download = useCallback(async () => {
    setBusy(true);
    try { await downloadFile(path, session.token, `complaint-${brief?.reference ?? 'report'}.html`); toast('Report downloaded.', 'ok'); }
    catch (e) { toast(errorMessage(e), 'error'); }
    finally { setBusy(false); }
  }, [path, session.token, brief?.reference, toast]);
  const print = useCallback(async () => {
    setBusy(true);
    try {
      const url = URL.createObjectURL(await fetchBlob(path, session.token));
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
      frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000); };
      frame.src = url; document.body.appendChild(frame);
    } catch (e) { toast(errorMessage(e), 'error'); }
    finally { setBusy(false); }
  }, [path, session.token, toast]);

  if (!brief || step === null) {
    return (
      <div className="v-page"><HelpStrip />
        <main className="v-main">
          {c.loadError ? (
            <div className="v-empty" role="alert"><p><strong>We could not open this complaint.</strong></p><p className="v-muted">{c.loadError}</p>
              <div className="v-actions"><button className="cg-btn v-primary" onClick={() => void c.reload()}>Try again</button><Link className="v-link" to="/">My complaints</Link></div></div>
          ) : (
            <div aria-busy="true" aria-label="Opening your complaint"><div className="cg-skeleton v-sk-row" /><div className="cg-skeleton v-sk-row" /><div className="cg-skeleton v-sk-row" /></div>
          )}
        </main>
      </div>
    );
  }

  if (brief.status === 'SUBMITTED') {
    return (
      <div className="v-page"><HelpStrip />
        <header className="v-bar"><Link to="/" className="v-back"><ChevronLeft size={18} /> My complaints</Link><span className="mono v-ref-small">{brief.reference}</span></header>
        <main className="v-main"><Submitted brief={brief} fresh={justSubmitted} busy={busy} onDownload={download} onPrint={print} /></main>
      </div>
    );
  }

  const uploading = c.uploads.some((u) => u.status === 'uploading');
  const saving = uploading || continuing;
  const openCount = brief.questions.filter((q) => q.status === 'OPEN').length;

  return (
    <div className="v-page v-flow">
      <HelpStrip />
      <header className="v-bar">
        <Link to="/" className="v-back"><ChevronLeft size={18} /> <span>My complaints</span></Link>
        <p className={`v-saved${saving ? ' is-saving' : ''}`} role="status" aria-live="polite">
          {saving ? <><span className="v-spin" aria-hidden="true" /> Saving…</> : <><CheckIcon size={14} /> Saved</>}
        </p>
      </header>
      <Stepper current={step} reached={reached} onGo={(n) => void go(n)} />
      <main className="v-main">
        {step === 1 && (
          <StepTell brief={brief} caseId={caseId} token={session.token} uploads={c.uploads} draft={draft} fix={fix} continuing={continuing}
            onDraft={(update, voice) => setDraft((d) => ({ text: update(d.text), voice: d.voice || !!voice }))}
            onFiles={c.addFiles} onDelete={c.deleteEvidence} onRetry={c.retryUpload} onDismiss={c.dismissUpload}
            onContinue={() => { setContinuing(true); void flush().then((ok) => { if (ok) { c.analyzeNow(); void go(2); } }).finally(() => setContinuing(false)); }} />
        )}
        {step === 2 && (
          qSnap ? (
            <StepQuestions questions={qSnap}
              onAnswer={async (id, text) => { await c.answer(id, text); if (text !== 'UNKNOWN') answeredAny.current = true; }}
              onDone={finishQuestions} onSkip={finishQuestions} onBack={() => void go(1)} />
          ) : c.analysisError ? (
            <div className="v-screen" role="alert">
              <h1 className="v-h1" tabIndex={-1}>We could not finish reading</h1>
              <p className="v-lead">{c.analysisError}</p>
              <div className="v-actionbar v-actionbar--pair">
                <button type="button" className="cg-btn cg-btn--ghost v-secondary" onClick={() => void go(1)}>Go back</button>
                <button type="button" className="cg-btn v-primary" onClick={c.analyzeNow}>Try again</button>
              </div>
            </div>
          ) : <div className="v-screen"><AnalysisProgress /></div>
        )}
        {step === 3 && (
          <StepCheck brief={brief} analyzing={analyzing} error={c.analysisError} openQuestions={openCount}
            onCategory={(category) => void c.patch({ category }).catch((e) => toast(errorMessage(e), 'error'))}
            onRetry={c.analyzeNow} onNext={() => void go(4)} onQuestions={() => void go(2)}
            onAddMore={() => void go(1)} onFix={() => { setFix(true); setStep(1); setQSnap(null); }} />
        )}
        {step === 4 && (
          <StepSend brief={brief} title={title} onTitle={setTitle} updating={analyzing} busy={busy} onDownload={() => void download()}
            onGo={(n) => void go(n)}
            onConfirm={async () => {
              if (title.trim() && title.trim() !== brief.title) await c.patch({ title: title.trim() });
              await c.submit(); setJustSubmitted(true);
            }} />
        )}
      </main>
    </div>
  );
}
