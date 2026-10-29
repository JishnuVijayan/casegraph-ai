import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AnalystPanel } from './AnalystPanel';
import { DemoBadge } from './DemoBadge';
import { EvidencePanel } from './EvidencePanel';
import { ExportPanel } from './ExportPanel';
import { QuestionsPanel } from './QuestionsPanel';
import { ReviewPanel } from './ReviewPanel';
import { api, ApiFailure } from './api';
import type { CaseDetail, CaseSummary, Session } from './types';

export function OfficerInboxPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function clear() {
    setSession(null); setCases([]); setDetail(null);
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

  if (session?.user.role === 'victim') return <Navigate to="/" replace />;

  if (!session) {
    return (
      <section className="hero-shell" aria-labelledby="officer-brand">
        <div className="hero-content hero-split">
          <div className="hero-copy">
            <div className="anim-rise"><DemoBadge /></div>
            <h1 id="officer-brand" className="hero-brand anim-rise">CaseGraph AI</h1>
            <p className="hero-headline anim-rise-delay">Review complaints and related-case leads.</p>
            <p className="hero-support anim-rise-delay">
              Open a filed complaint for timeline, evidence, draft report, and similar-case search.
            </p>
          </div>
          <form className="intake-card anim-fade" onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              clear();
              const next = await api<Session>('/auth/demo', undefined, { demoSubject: 'synthetic-analyst' }, 'POST');
              if (next.user.role !== 'analyst') {
                setSession(next);
                return;
              }
              const rows = await api<CaseSummary[]>('/cases', next.token);
              setSession(next); setCases(rows);
            });
          }}>
            <p className="intake-card-kicker">Officer access</p>
            <h2 className="intake-card-title">Demo workspace</h2>
            <p className="panel-lead" style={{ marginBottom: '1rem' }}>
              Synthetic analyst login. Cases shared via auto-grant appear in your inbox.
            </p>
            <button className="btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Continue as officer'}
            </button>
            <p className="intake-foot">
              <Link to="/">File a complaint</Link>
            </p>
            {error && <p role="alert">{error}</p>}
          </form>
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
        <div className="session-chip">
          <p className="m-0 font-semibold">{session.user.displayName}</p>
          <p className="m-0 text-sm session-chip-muted">Officer workspace</p>
          <button className="btn-ghost btn-compact" disabled={busy} onClick={() => void perform(async () => {
            try { await api('/auth/logout', session.token, {}, 'POST'); } finally { clear(); }
          })}>Sign out</button>
        </div>
      </header>

      <section className="workspace-panel" aria-labelledby="inbox-title">
        <span className="step-label">Inbox</span>
        <h2 id="inbox-title" className="text-xl font-bold m-0">Complaints</h2>
        <p className="mt-2" style={{ color: 'var(--muted)' }}>Cases shared with your organization for investigation.</p>
        <button disabled={busy} onClick={() => void perform(async () => {
          setDetail(null);
          setCases(await api<CaseSummary[]>('/cases', session.token));
        })}>Refresh inbox</button>
        {cases.length ? (
          <ul className="case-list" aria-label="Complaint inbox">
            {cases.map((row) => (
              <li key={row.id}>
                <button
                  data-case-id={row.id}
                  aria-current={detail?.id === row.id ? 'true' : undefined}
                  disabled={busy}
                  onClick={() => void perform(() => openCase(row.id))}
                >
                  <strong>{row.title}</strong>
                  <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                    {' · '}{row.status}{row.category ? ` · ${row.category}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No complaints in your inbox yet.</p>
        )}
      </section>

      {detail && (
        <article aria-label="Case report" className="anim-rise">
          <section className="workspace-panel">
            <span className="step-label">Case report</span>
            <h2 className="text-2xl font-bold m-0">{detail.title}</h2>
            <p className="mt-2 mb-0" style={{ color: 'var(--muted)' }}>
              {detail.status} · {detail.category} · ID {detail.id}
            </p>
          </section>

          <section className="workspace-panel">
            <span className="step-label">Evidence</span>
            <EvidencePanel
              key={`evidence-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              owner={false}
              busy={busy}
              perform={perform}
            />
          </section>

          <section className="workspace-panel">
            <span className="step-label">Timeline and claims</span>
            <ReviewPanel
              key={`review-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              owner={false}
              busy={busy}
              refreshKey={0}
              perform={perform}
            />
          </section>

          <section className="workspace-panel">
            <span className="step-label">Clarifications</span>
            <QuestionsPanel
              key={`questions-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              owner={false}
              busy={busy}
              perform={perform}
            />
          </section>

          <section className="workspace-panel">
            <span className="step-label">Complaint draft</span>
            <ExportPanel
              key={`export-${detail.id}`}
              token={session.token}
              caseId={detail.id}
              busy={busy}
              perform={perform}
            />
          </section>

          <section className="workspace-panel">
            <span className="step-label">Similar cases</span>
            <AnalystPanel
              key={`analyst-${detail.id}`}
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
      <p style={{ color: 'var(--muted)' }}><Link to="/">File a complaint</Link></p>
    </div>
  );
}
