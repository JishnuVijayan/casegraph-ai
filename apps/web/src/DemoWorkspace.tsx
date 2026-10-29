import { AnalystPanel } from './AnalystPanel';
import { ExportPanel } from './ExportPanel';
import { QuestionsPanel } from './QuestionsPanel';
import { useState } from 'react';
import { EvidencePanel } from './EvidencePanel';
import { ReviewPanel } from './ReviewPanel';
import { api, ApiFailure } from './api';

type Identity = { id: string; displayName: string; role: 'victim' | 'analyst' };
type CaseSummary = { id: string; title: string; status: string; synthetic: true };
type CaseDetail = CaseSummary & { category: string };
type Session = { token: string; user: Identity };
const organizationId = '10000000-0000-4000-8000-000000000001';


export function DemoWorkspace() {
  // In-memory only: reloads and sign-out clear the browser's token and private view.
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('other');
  const [subject, setSubject] = useState('synthetic-victim-a');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseId, setCaseId] = useState('');
  const [reviewKey, setReviewKey] = useState(0);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [scope, setScope] = useState('READ');
  const [grant, setGrant] = useState<{ id: string; caseId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function clear() { setSession(null); setCases([]); setDetail(null); setCaseId(''); setGrant(null); setTitle(''); }
  async function perform(operation: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 401) clear();
      setError(failure instanceof Error ? failure.message : 'Request failed.');
    } finally { setBusy(false); }
  }
  return <section aria-labelledby="demo-title">
    <h2 id="demo-title" className="text-xl font-bold">Local synthetic demo</h2>
    <p>Fictional role simulation only. Choosing an identity is not real identity verification. No real victim data.</p>
    <p>Create synthetic cases, review local OCR, save source-linked claims and build a sourced timeline. Review and download a draft export. Investigation requires an available TigerGraph instance and explicit investigation grants.</p>
    {!session ? <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
      clear();
      const next = await api<Session>('/auth/demo', undefined, { demoSubject: subject }, 'POST');
      const rows = await api<CaseSummary[]>('/cases', next.token);
      setSession(next); setCases(rows); setCaseId(rows[0]?.id ?? '');
    }); }}>
      <label htmlFor="demo-identity">Fictional identity</label>
      <select id="demo-identity" disabled={busy} value={subject} onChange={(event) => setSubject(event.target.value)}>
        <option value="synthetic-victim-a">Fictional Victim A</option>
        <option value="synthetic-victim-b">Fictional Victim B</option>
        <option value="synthetic-analyst">Fictional Analyst</option>
      </select>
      <button disabled={busy} type="submit">Sign in to local demo</button>
      <p>Demo sign-in is disabled by default. Start seeded local services and use <code>npm run dev:demo</code>.</p>
    </form> : <>
      <p>Signed in as {session.user.displayName} ({session.user.role}).</p>
      <button disabled={busy} onClick={() => void perform(async () => {
        try { await api('/auth/logout', session.token, {}, 'POST'); } finally { clear(); }
      })}>Sign out</button>
      {session.user.role === 'victim' && <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
        const row = await api<CaseDetail>('/cases', session.token, { title, category, syntheticAcknowledged: true }, 'POST');
        setDetail(row); setCaseId(row.id); setTitle(''); setGrant(null);
        setCases(await api<CaseSummary[]>('/cases', session.token));
      }); }}>
        <h3 className="mt-4 text-lg font-bold">Create a synthetic draft</h3>
        <label htmlFor="new-case-title">Fictional case title</label>
        <input id="new-case-title" maxLength={120} value={title} required disabled={busy} onChange={(event) => setTitle(event.target.value)} />
        <label htmlFor="new-case-category">Category</label>
        <select id="new-case-category" value={category} disabled={busy} onChange={(event) => setCategory(event.target.value)}>
          <option value="other">Other</option><option value="payment">Payment</option><option value="investment">Investment</option><option value="friendship">Friendship</option>
        </select>
        <label><input type="checkbox" required disabled={busy} /> This draft contains only fictional/synthetic data.</label>
        <button type="submit" disabled={busy}>Create draft</button>
      </form>}
      <h3 className="mt-4 text-lg font-bold">Cases you can access</h3>
      {cases.length ? <ul>{cases.map((row) => <li key={row.id}>
        <button disabled={busy} onClick={() => { setCaseId(row.id); setDetail(null); }}>{row.title}</button>
      </li>)}</ul> : <p>No cases are currently shared with this identity.</p>}
      <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
        setDetail(null);
        const row = await api<CaseDetail>(`/cases/${encodeURIComponent(caseId)}`, session.token);
        setDetail(row);
      }); }}>
        <label htmlFor="case-id">Case ID</label>
        <input id="case-id" value={caseId} disabled={busy} onChange={(event) => { setCaseId(event.target.value); setDetail(null); }} />
        <button disabled={busy || !caseId} type="submit">Read case</button>
      </form>
      {detail && <article aria-label="Case details" className="my-4 rounded border p-4">
        <h3 className="text-lg font-bold">{detail.title}</h3>
        <p>Synthetic placeholder · {detail.status} · {detail.category}</p>
        <p>Uploads are unverified user-supplied material, not bank-verified records.</p>
        <EvidencePanel key={`evidence-${detail.id}`} token={session.token} caseId={detail.id} owner={session.user.role === 'victim'} busy={busy} perform={perform} onClaimAdded={() => setReviewKey((value) => value + 1)} />
        <ReviewPanel key={`review-${detail.id}`} token={session.token} caseId={detail.id} owner={session.user.role === 'victim'} busy={busy} refreshKey={reviewKey} perform={perform} />
        {session.user.role === 'analyst' && <AnalystPanel key={`analyst-${detail.id}`} token={session.token} caseId={detail.id} busy={busy} perform={perform} />}
        <ExportPanel key={`export-${detail.id}`} token={session.token} caseId={detail.id} busy={busy} perform={perform} />
        <QuestionsPanel key={`questions-${detail.id}`} token={session.token} caseId={detail.id} owner={session.user.role === 'victim'} busy={busy} perform={perform} />
        {session.user.role === 'victim' && <div>
          <p>Explicitly share this case with the Fictional Demo Consortium.</p>
          <label htmlFor="share-scope">Permission</label>
          <select id="share-scope" value={scope} disabled={busy} onChange={(event) => setScope(event.target.value)}>
            <option value="READ">Read case</option><option value="INVESTIGATE">Read and investigate synthetic graph</option>
          </select>
          <button disabled={busy} onClick={() => void perform(async () => {
            const row = await api<{ id: string }>(`/cases/${detail.id}/shares`, session.token, { organizationId, scope }, 'POST');
            setGrant({ id: row.id, caseId: detail.id }); setNotice('Explicit synthetic case grant recorded.');
          })}>Grant access</button>
        </div>}
      </article>}
      {grant && <button disabled={busy} onClick={() => void perform(async () => {
        await api(`/cases/${grant.caseId}/shares/${grant.id}`, session.token, undefined, 'DELETE');
        setGrant(null); setNotice('Grant revoked. Any other active grant still applies.');
      })}>Revoke last grant</button>}
      <button disabled={busy} onClick={() => void perform(async () => {
        setDetail(null); setCases([]);
        const rows = await api<CaseSummary[]>('/cases', session.token); setCases(rows);
      })}>Refresh permitted cases</button>
    </>}
    {busy && <p role="status">Checking local access…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <p>No paid APIs. No official government, police or bank affiliation.</p>
  </section>;
}
