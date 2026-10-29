import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { DemoBadge } from './DemoBadge';
import { EvidencePanel } from './EvidencePanel';
import { ExportPanel } from './ExportPanel';
import { QuestionsPanel } from './QuestionsPanel';
import { ReviewPanel } from './ReviewPanel';
import { api, ApiFailure } from './api';
import type { CaseDetail, CaseSummary, Session } from './types';

export function VictimFilingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('other');
  const [subject, setSubject] = useState('synthetic-victim-a');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [reviewKey, setReviewKey] = useState(0);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function clear() {
    setSession(null); setCases([]); setDetail(null); setTitle('');
  }

  async function perform(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); }
    catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 401) clear();
      setError(failure instanceof Error ? failure.message : 'Request failed.');
    } finally { setBusy(false); }
  }

  async function openCase(id: string, token = session!.token) {
    setDetail(null);
    setDetail(await api<CaseDetail>(`/cases/${encodeURIComponent(id)}`, token));
  }

  if (session?.user.role === 'analyst') return <Navigate to="/officer" replace />;

  if (!session) {
    return (
      <section className="hero-shell" aria-labelledby="hero-brand">
        <div className="hero-content">
          <div className="anim-rise"><DemoBadge /></div>
          <h1 id="hero-brand" className="hero-brand anim-rise">CaseGraph AI</h1>
          <p className="hero-headline anim-rise-delay">Turn scattered evidence into a clear complaint draft.</p>
          <p className="hero-support anim-rise-delay">Upload screenshots, reconstruct amounts and timelines, then export a reviewable report.</p>
          <form className="hero-cta anim-fade" onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              clear();
              const next = await api<Session>('/auth/demo', undefined, { demoSubject: subject }, 'POST');
              if (next.user.role !== 'victim') {
                setSession(next);
                return;
              }
              const rows = await api<CaseSummary[]>('/cases', next.token);
              setSession(next); setCases(rows);
              if (rows[0]) await openCase(rows[0].id, next.token);
            });
          }}>
            <div>
              <label htmlFor="demo-identity">Fictional identity</label>
              <select id="demo-identity" disabled={busy} value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option value="synthetic-victim-a">Fictional Victim A</option>
                <option value="synthetic-victim-b">Fictional Victim B</option>
              </select>
            </div>
            <button className="btn-primary" disabled={busy} type="submit">Continue</button>
          </form>
          <p className="anim-fade" style={{ color: 'var(--muted)' }}>
            <Link to="/officer">Officer workspace</Link>
          </p>
          {busy && <p role="status">Signing in…</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <div className="workspace anim-fade">
      <header className="workspace-header">
        <div>
          <p className="brand-mark text-2xl m-0">CaseGraph AI</p>
          <div className="mt-2"><DemoBadge /></div>
        </div>
        <div className="text-right">
          <p className="m-0 font-semibold">{session.user.displayName}</p>
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>Filing a complaint</p>
          <button disabled={busy} onClick={() => void perform(async () => {
            try { await api('/auth/logout', session.token, {}, 'POST'); } finally { clear(); }
          })}>Sign out</button>
        </div>
      </header>

      <section className="workspace-panel" aria-labelledby="create-case-title">
        <span className="step-label">Step 1</span>
        <h2 id="create-case-title" className="text-xl font-bold m-0">Start a complaint draft</h2>
        <p className="mt-2 mb-3" style={{ color: 'var(--muted)' }}>Give the case a short title, then add evidence in any order.</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            const row = await api<CaseDetail>('/cases', session.token, { title, category, syntheticAcknowledged: true }, 'POST');
            setDetail(row); setTitle('');
            setCases(await api<CaseSummary[]>('/cases', session.token));
          });
        }}>
          <label htmlFor="new-case-title">Case title</label>
          <input id="new-case-title" maxLength={120} value={title} required disabled={busy} onChange={(event) => setTitle(event.target.value)} />
          <label htmlFor="new-case-category">Category</label>
          <select id="new-case-category" value={category} disabled={busy} onChange={(event) => setCategory(event.target.value)}>
            <option value="other">Other</option>
            <option value="payment">Payment</option>
            <option value="investment">Investment</option>
            <option value="friendship">Friendship</option>
          </select>
          <div className="mt-3">
            <button className="btn-primary" type="submit" disabled={busy}>Create draft</button>
          </div>
        </form>
      </section>

      <section className="workspace-panel" aria-labelledby="cases-title">
        <span className="step-label">Your cases</span>
        <h2 id="cases-title" className="text-xl font-bold m-0">Open a case</h2>
        {cases.length ? (
          <ul className="case-list">
            {cases.map((row) => (
              <li key={row.id}>
                <button
                  data-case-id={row.id}
                  aria-current={detail?.id === row.id ? 'true' : undefined}
                  disabled={busy}
                  onClick={() => void perform(() => openCase(row.id))}
                >
                  {row.title}
                  <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {row.status}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No cases yet. Create a draft to begin.</p>
        )}
      </section>

      {detail && (
        <article aria-label="Case details" className="anim-rise">
          <section className="workspace-panel">
            <span className="step-label">Active case</span>
            <h2 className="text-2xl font-bold m-0">{detail.title}</h2>
            <p className="mt-2 mb-0" style={{ color: 'var(--muted)' }}>{detail.status} · {detail.category}</p>
          </section>

          <section className="workspace-panel">
            <span className="step-label">Step 2</span>
            <EvidencePanel
              key={`evidence-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              owner
              busy={busy}
              perform={perform}
              onClaimAdded={() => setReviewKey((value) => value + 1)}
            />
          </section>

          <section className="workspace-panel">
            <span className="step-label">Step 3</span>
            <ReviewPanel
              key={`review-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              owner
              busy={busy}
              refreshKey={reviewKey}
              perform={perform}
            />
          </section>

          <section className="workspace-panel">
            <span className="step-label">Step 4</span>
            <QuestionsPanel
              key={`questions-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              owner
              busy={busy}
              perform={perform}
            />
          </section>

          <section className="workspace-panel">
            <span className="step-label">Step 5</span>
            <ExportPanel
              key={`export-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              busy={busy}
              perform={perform}
            />
          </section>
        </article>
      )}

      {busy && <p role="status">Working…</p>}
      {error && <p role="alert">{error}</p>}
      <p style={{ color: 'var(--muted)' }}><Link to="/officer">Officer workspace</Link></p>
    </div>
  );
}
