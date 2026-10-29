import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { DemoBadge } from './DemoBadge';
import { OfficerCaseReport } from './OfficerCaseReport';
import { api, ApiFailure } from './api';
import type { CaseDetail, CaseSummary, Session } from './types';

type InboxRow = CaseSummary & { leadCount?: number };

export function OfficerInboxPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [cases, setCases] = useState<InboxRow[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fixtureId, setFixtureId] = useState('');

  function clear() {
    setSession(null); setCases([]); setDetail(null); setFixtureId('');
  }

  async function perform(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); }
    catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 401) clear();
      setError(failure instanceof Error ? failure.message : 'Request failed.');
    } finally { setBusy(false); }
  }

  async function loadInbox(token: string) {
    const rows = await api<CaseSummary[]>('/cases', token);
    const withLeads = await Promise.all(rows.map(async (row) => {
      try {
        const leads = await api<unknown[]>(`/investigations/${row.id}/graph-leads`, token);
        return { ...row, leadCount: leads.length };
      } catch {
        return { ...row, leadCount: 0 };
      }
    }));
    setCases(withLeads);
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
              Open a submitted complaint for screenshots, answers, draft report, and similar-case leads.
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
              await loadInbox(next.token);
              setSession(next);
            });
          }}>
            <p className="intake-card-kicker">Officer access</p>
            <h2 className="intake-card-title">Demo workspace</h2>
            <p className="panel-lead" style={{ marginBottom: '1rem' }}>
              Demo officer login. Submitted complaints shared with your organization appear here.
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
        <h2 id="inbox-title" className="text-xl font-bold m-0">Submitted complaints</h2>
        <p className="mt-2" style={{ color: 'var(--muted)' }}>
          Only complaints marked ready for review after victim submit.
        </p>
        <button disabled={busy} onClick={() => void perform(async () => {
          setDetail(null);
          await loadInbox(session.token);
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
                    {' · '}{row.category || 'case'}
                    {row.updatedAt ? ` · ${new Date(row.updatedAt).toLocaleString()}` : ''}
                    {typeof row.leadCount === 'number' && row.leadCount > 0 ? ` · ${row.leadCount} lead${row.leadCount === 1 ? '' : 's'}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No submitted complaints yet.</p>
        )}
        <details className="inbox-advanced">
          <summary>Open by reference</summary>
          <p className="panel-lead">For demo fixtures that are not in the submitted inbox.</p>
          <label htmlFor="fixture-case-id">Case reference</label>
          <input
            id="fixture-case-id"
            value={fixtureId}
            disabled={busy}
            onChange={(event) => setFixtureId(event.target.value.trim())}
            placeholder="UUID"
          />
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || !fixtureId}
            onClick={() => void perform(() => openCase(fixtureId))}
          >
            Open complaint
          </button>
        </details>
      </section>

      {detail && (
        <OfficerCaseReport
          key={detail.id}
          token={session.token}
          detail={detail}
          busy={busy}
          perform={perform}
        />
      )}

      {busy && <p role="status">Working…</p>}
      {error && <p role="alert">{error}</p>}
      <p style={{ color: 'var(--muted)' }}><Link to="/">File a complaint</Link></p>
    </div>
  );
}
