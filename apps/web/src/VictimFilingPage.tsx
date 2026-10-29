import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { DemoBadge } from './DemoBadge';
import { QuestionsPanel } from './QuestionsPanel';
import { VictimUploadZone } from './VictimUploadZone';
import { api, ApiFailure } from './api';
import type { CaseDetail, Session } from './types';

type Step = 'intake' | 'details' | 'questions' | 'ready' | 'done';
type SubmitResult = {
  caseId: string; status: string; exportId: string; exportVersion: number;
  leadsStatus: string; similarCaseCount: number;
};
type PrepareResult = { caseId: string; evidenceCount: number; claimCount: number; openQuestions: number };

const WIZARD_STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'questions', label: 'Questions' },
] as const;

const CATEGORIES = [
  { value: 'payment', label: 'Payment' },
  { value: 'investment', label: 'Investment' },
  { value: 'friendship', label: 'Friendship' },
  { value: 'other', label: 'Other' },
] as const;

function stepIndex(step: Step): number {
  if (step === 'details') return 0;
  if (step === 'questions' || step === 'ready') return 1;
  return -1;
}

function WizardProgress({ step }: { step: Step }) {
  const active = stepIndex(step);
  if (active < 0) return null;
  const labels = step === 'ready'
    ? [{ id: 'details', label: 'Details' }, { id: 'questions', label: 'Submit' }] as const
    : WIZARD_STEPS;
  return (
    <nav className="wizard-progress wizard-progress-2" aria-label="Complaint steps">
      {labels.map((item, index) => {
        const state = index < active ? 'done' : index === active ? 'current' : 'todo';
        return (
          <div key={item.id} className={`wizard-step wizard-step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="wizard-step-index" aria-hidden="true">{index < active ? '✓' : index + 1}</span>
            <span className="wizard-step-label">{item.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

export function VictimFilingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<Step>('intake');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [category, setCategory] = useState('payment');
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [readyUploads, setReadyUploads] = useState(0);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  function clear() {
    setSession(null); setDetail(null); setSubmitResult(null); setStep('intake');
    setName(''); setMobile(''); setSummary(''); setCategory('payment');
    setReadyUploads(0); setStatus('');
  }

  async function perform(operation: () => Promise<void>) {
    setBusy(true); setError(''); setStatus('');
    try { await operation(); }
    catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 401) clear();
      setError(failure instanceof Error ? failure.message : 'Request failed.');
    } finally { setBusy(false); setStatus(''); }
  }

  async function submitComplaint(caseId: string, token: string) {
    const result = await api<SubmitResult>(
      `/cases/${encodeURIComponent(caseId)}/submit`,
      token, {}, 'POST',
    );
    setSubmitResult(result);
    setStep('done');
  }

  if (session?.user.role === 'analyst') return <Navigate to="/officer" replace />;

  if (step === 'intake' || !session) {
    return (
      <section className="hero-shell" aria-labelledby="hero-brand">
        <div className="hero-content hero-split">
          <div className="hero-copy">
            <div className="anim-rise"><DemoBadge /></div>
            <h1 id="hero-brand" className="hero-brand anim-rise">CaseGraph AI</h1>
            <p className="hero-headline anim-rise-delay">File a complaint in a few clear steps.</p>
            <p className="hero-support anim-rise-delay">
              Enter your name and mobile, describe what happened, upload screenshots, answer only what’s still missing, then submit.
            </p>
            <aside className="safety-callout anim-fade" aria-label="Immediate reporting guidance">
              <p className="safety-callout-title">If money is still at risk</p>
              <p className="m-0">
                Call <strong>1930</strong>, notify your bank immediately, and use{' '}
                <a href="https://www.cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>.
                This demo does not file an FIR or recover funds.
              </p>
            </aside>
          </div>

          <form className="intake-card anim-fade" onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              const digits = mobile.replace(/\D/g, '');
              const next = await api<Session>('/auth/intake', undefined, {
                displayName: name.trim(), mobile: digits,
              }, 'POST');
              if (next.user.role !== 'victim') {
                setSession(next);
                return;
              }
              setSession(next);
              setStep('details');
            });
          }}>
            <p className="intake-card-kicker">Start filing</p>
            <h2 className="intake-card-title">Your details</h2>
            <div className="field-stack">
              <div>
                <label htmlFor="intake-name">Your name</label>
                <input
                  id="intake-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  disabled={busy}
                  value={name}
                  placeholder="As you’d like officers to see it"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="intake-mobile">Mobile number</label>
                <div className="mobile-field">
                  <span className="mobile-prefix" aria-hidden="true">+91</span>
                  <input
                    id="intake-mobile"
                    name="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    disabled={busy}
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </div>
            </div>
            <button className="btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Starting…' : 'Continue'}
            </button>
            <p className="intake-foot">
              Demo session only — not OTP or KYC verification.{' '}
              <Link to="/officer">Officer workspace</Link>
            </p>
            {error && <p role="alert">{error}</p>}
          </form>
        </div>
      </section>
    );
  }

  if (step === 'done' && submitResult) {
    return (
      <div className="workspace anim-fade">
        <header className="workspace-header">
          <div>
            <p className="brand-mark text-2xl m-0">CaseGraph AI</p>
            <div className="mt-2"><DemoBadge /></div>
          </div>
          <button className="btn-ghost" disabled={busy} onClick={() => clear()}>File another</button>
        </header>
        <section className="success-panel workspace-panel" aria-labelledby="submitted-title">
          <div className="success-mark" aria-hidden="true">✓</div>
          <span className="step-label">Submitted</span>
          <h2 id="submitted-title" className="text-2xl font-bold m-0">Complaint submitted for review</h2>
          <p className="success-lead">
            Your complaint package is ready for an officer to review.
            {submitResult.leadsStatus === 'UNAVAILABLE' && (
              <> Similar-case search was unavailable; officers can retry later.</>
            )}
          </p>
          <dl className="success-meta">
            <div>
              <dt>Reference</dt>
              <dd><code>{submitResult.caseId}</code></dd>
            </div>
          </dl>
          <div className="action-row">
            <Link className="btn-primary btn-link" to="/officer">Open officer workspace</Link>
            <button className="btn-ghost" type="button" disabled={busy} onClick={() => clear()}>
              File another complaint
            </button>
          </div>
        </section>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="workspace anim-fade">
      <header className="workspace-header">
        <div>
          <p className="brand-mark text-2xl m-0">CaseGraph AI</p>
          <div className="mt-2"><DemoBadge /></div>
        </div>
        <div className="session-chip">
          <p className="m-0 font-semibold">{session.user.displayName}</p>
          <p className="m-0 text-sm session-chip-muted">Filing a complaint</p>
          <button className="btn-ghost btn-compact" disabled={busy} onClick={() => void perform(async () => {
            try { await api('/auth/logout', session.token, {}, 'POST'); } finally { clear(); }
          })}>Sign out</button>
        </div>
      </header>

      <WizardProgress step={step} />

      {step === 'details' && (
        <section className="workspace-panel wizard-panel" aria-labelledby="details-title">
          <span className="step-label">Step 1 of 2</span>
          <h2 id="details-title" className="panel-title">What happened?</h2>
          <p className="panel-lead">
            Briefly describe the incident, then add screenshots or receipts.
          </p>
          {!detail ? (
            <form className="details-form" onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                const title = summary.trim().slice(0, 120) || `${category} complaint`;
                const row = await api<CaseDetail>('/cases', session.token, {
                  title, category, syntheticAcknowledged: true,
                }, 'POST');
                setDetail(row);
              });
            }}>
              <fieldset className="category-fieldset">
                <legend>Category</legend>
                <div className="category-grid">
                  {CATEGORIES.map((item) => (
                    <label key={item.value} className={`category-chip${category === item.value ? ' is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="complaint-category"
                        value={item.value}
                        checked={category === item.value}
                        disabled={busy}
                        onChange={() => setCategory(item.value)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="complaint-summary">Short description</label>
              <textarea
                id="complaint-summary"
                required
                maxLength={500}
                rows={4}
                disabled={busy}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Example: Lost money after a fake UPI request"
              />
              <p className="char-hint">{summary.length}/500</p>
              <div className="action-row">
                <button className="btn-primary" type="submit" disabled={busy || !summary.trim()}>
                  Continue to uploads
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="case-chip">
                <strong>{detail.title}</strong>
                <span>{detail.category}</span>
              </div>
              <VictimUploadZone
                key={`evidence-${detail.id}`}
                token={session.token}
                caseId={detail.id}
                busy={busy}
                perform={perform}
                onReadyCount={setReadyUploads}
              />
              <div className="action-row mt-4">
                <button className="btn-primary" type="button" disabled={busy || readyUploads < 1}
                  onClick={() => void perform(async () => {
                    setStatus('Reading your screenshots and checking what’s missing…');
                    const prepared = await api<PrepareResult>(
                      `/cases/${encodeURIComponent(detail.id)}/prepare`,
                      session.token, {}, 'POST',
                    );
                    setStep(prepared.openQuestions > 0 ? 'questions' : 'ready');
                  })}>
                  Continue
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 'questions' && detail && (
        <section className="workspace-panel wizard-panel" aria-labelledby="questions-title">
          <span className="step-label">Step 2 of 2</span>
          <h2 id="questions-title" className="panel-title">A few more details</h2>
          <p className="panel-lead">
            Answer only what is still missing, or say you don’t remember. Then submit.
          </p>
          <QuestionsPanel
            key={`questions-${detail.id}`}
            token={session.token}
            caseId={detail.id}
            owner
            busy={busy}
            perform={perform}
            autoRefresh
            compact
          />
          <div className="action-row mt-4">
            <button className="btn-ghost" type="button" disabled={busy} onClick={() => setStep('details')}>Back</button>
            <button className="btn-primary" type="button" disabled={busy}
              onClick={() => void perform(() => submitComplaint(detail.id, session.token))}>
              Submit complaint
            </button>
          </div>
        </section>
      )}

      {step === 'ready' && detail && (
        <section className="workspace-panel wizard-panel" aria-labelledby="ready-title">
          <span className="step-label">Step 2 of 2</span>
          <h2 id="ready-title" className="panel-title">Ready to submit</h2>
          <p className="panel-lead">
            We already have the essentials from your description and screenshots. Nothing else is missing.
          </p>
          <div className="action-row mt-4">
            <button className="btn-ghost" type="button" disabled={busy} onClick={() => setStep('details')}>Back</button>
            <button className="btn-primary" type="button" disabled={busy}
              onClick={() => void perform(() => submitComplaint(detail.id, session.token))}>
              Submit complaint
            </button>
          </div>
        </section>
      )}

      {(busy || status) && <p className="status-line" role="status">{status || 'Working…'}</p>}
      {error && <p role="alert">{error}</p>}
      <p className="workspace-foot">
        <Link to="/officer">Officer workspace</Link>
      </p>
    </div>
  );
}
