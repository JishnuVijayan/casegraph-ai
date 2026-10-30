import { useState, type FormEvent } from 'react';
import { jsonRequest } from './officerApi';
import { useOfficer } from './session';
import type { Session } from '../types.v2';

export function SignIn() {
  const { signIn, expired } = useOfficer();
  const [officerId, setOfficerId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) { setError('Enter the officer password.'); return; }
    setBusy(true); setError('');
    try {
      const s = await jsonRequest<Session>('/auth/demo', undefined, {
        method: 'POST',
        body: { demoSubject: 'synthetic-analyst', password },
      });
      signIn(s, officerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <main className="o-signin">
      <section className="o-signin__brand" aria-hidden="true">
        <div className="o-brandmark"><img className="o-logo" src="/icon-192.png" alt="" width={34} height={34} /> CaseGraph</div>
        <h2>Every complaint,<br />connected.</h2>
        <p>See the full story, the evidence, and every earlier complaint that shares a phone number, UPI ID or website, in one place.</p>
      </section>
      <section className="o-signin__panel">
        <form className="o-signin__form" onSubmit={submit} aria-labelledby="o-signin-title">
          <p className="cg-eyebrow">Cyber Crime Investigation Unit</p>
          <h1 id="o-signin-title">Officer sign-in</h1>
          <p className="o-muted">Sign in to review submitted complaints and linked cases.</p>
          {expired && <p className="o-note" role="status">Your session ended. Please sign in again.</p>}
          <label className="cg-label" htmlFor="o-officer-id">Officer ID</label>
          <input id="o-officer-id" className="cg-input" autoComplete="username" placeholder="e.g. CCU-2041" value={officerId}
            onChange={(e) => setOfficerId(e.target.value)} autoFocus />
          <label className="cg-label" htmlFor="o-officer-password">Password</label>
          <input id="o-officer-password" className="cg-input" type="password" autoComplete="current-password"
            placeholder="Officer password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="o-field-error" role="alert">{error}</p>}
          <button className="cg-btn o-wide" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="o-fine">Access is logged. Use this workspace only for official investigations.</p>
        </form>
      </section>
    </main>
  );
}
