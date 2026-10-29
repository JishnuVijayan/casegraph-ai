import { useState } from 'react';

type Identity = { id: string; displayName: string; role: 'victim' | 'analyst' };
type CaseSummary = { id: string; title: string; status: string; synthetic: true };
type CaseDetail = CaseSummary & { category: string };
type Session = { token: string; user: Identity };
const organizationId = '10000000-0000-4000-8000-000000000001';

class ApiFailure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
async function api<T>(path: string, token?: string, body?: object, method = 'GET'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { method, cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiFailure(503, 'Local API unavailable. Start the local services and retry.'); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiFailure(response.status, payload?.error?.message ?? 'Local request failed.');
  return payload.data;
}

export function DemoWorkspace() {
  // In-memory only: reloads and sign-out clear the browser's token and private view.
  const [session, setSession] = useState<Session | null>(null);
  const [subject, setSubject] = useState('synthetic-victim-a');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseId, setCaseId] = useState('');
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [scope, setScope] = useState('READ');
  const [grant, setGrant] = useState<{ id: string; caseId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function clear() { setSession(null); setCases([]); setDetail(null); setCaseId(''); setGrant(null); }
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
    <p>Case creation, evidence upload, OCR, exports and TigerGraph investigation are not implemented yet.</p>
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
        <p>No evidence or verified bank records are attached.</p>
        {session.user.role === 'victim' && <div>
          <p>Explicitly share this case with the Fictional Demo Consortium.</p>
          <label htmlFor="share-scope">Permission</label>
          <select id="share-scope" value={scope} disabled={busy} onChange={(event) => setScope(event.target.value)}>
            <option value="READ">Read case</option><option value="INVESTIGATE">Read and future investigation scope</option>
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
