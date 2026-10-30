import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type { Session } from '../types.v2';
import { HelpStrip } from './HelpStrip';
import { CheckIcon, MicIcon, ShieldIcon, SparkIcon } from './icons';

export function Welcome({ onSession }: { onSession: (s: Session) => void }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [touched, setTouched] = useState({ name: false, mobile: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const digits = mobile.replace(/\D/g, '');
  const nameOk = name.trim().length > 0;
  const mobileOk = /^[6-9]\d{9}$/.test(digits);
  const nameError = touched.name && !nameOk ? 'Please type your name.' : '';
  const mobileError = touched.mobile && !mobileOk
    ? (digits.length === 10 ? 'Mobile numbers start with 6, 7, 8 or 9.' : 'Please enter all 10 digits of your mobile number.') : '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({ name: true, mobile: true });
    if (!nameOk || !mobileOk) return;
    setBusy(true); setError('');
    try {
      const session = await api<Session>('/auth/intake', undefined, { displayName: name.trim(), mobile: digits }, 'POST');
      if (session.user.role !== 'victim') { setError('This number belongs to an officer account. Please use the officer sign-in instead.'); return; }
      onSession(session);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  return (
    <div className="v-page">
      <HelpStrip />
      <main className="v-welcome">
        <section className="v-hero" aria-labelledby="v-hero-title">
          <p className="v-brand"><span className="v-brand-mark" aria-hidden="true" />CaseGraph</p>
          <h1 id="v-hero-title">Hit by a cyber crime? We will help you report it.</h1>
          <p className="v-hero-sub">Scam, hacking, threats, a fake profile, stolen data, anything online. Tell us what happened in your own words and we turn it into a clear complaint.</p>
          <ul className="v-points">
            <li><span><MicIcon size={20} /></span> Speak or type. Any language is fine.</li>
            <li><span><SparkIcon size={20} /></span> Add screenshots. We read them for you.</li>
            <li><span><ShieldIcon size={20} /></span> Private. Only you and the officers see it.</li>
          </ul>
        </section>

        <form className="v-card v-start" onSubmit={submit} noValidate aria-labelledby="v-start-title">
          <h2 id="v-start-title">Let's begin</h2>
          <p className="v-muted">Two quick things first. It takes a minute.</p>
          <div className="v-field">
            <label className="cg-label" htmlFor="v-name">Your name</label>
            <input id="v-name" className="cg-input" autoComplete="name" maxLength={80} value={name} disabled={busy}
              aria-invalid={!!nameError} aria-describedby={nameError ? 'v-name-err' : undefined}
              onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
            {nameError && <p id="v-name-err" className="v-field-err">{nameError}</p>}
          </div>
          <div className="v-field">
            <label className="cg-label" htmlFor="v-mobile">Mobile number</label>
            <div className="v-mobile">
              <span className="v-mobile-prefix" aria-hidden="true">+91</span>
              <input id="v-mobile" className="cg-input" inputMode="numeric" autoComplete="tel-national" maxLength={14} value={mobile} disabled={busy}
                aria-invalid={!!mobileError} aria-describedby={mobileError ? 'v-mobile-err' : 'v-mobile-hint'}
                onChange={(e) => setMobile(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, mobile: true }))} />
              {mobileOk && <span className="v-valid" aria-hidden="true"><CheckIcon size={18} /></span>}
            </div>
            {mobileError ? <p id="v-mobile-err" className="v-field-err">{mobileError}</p>
              : <p id="v-mobile-hint" className="v-hint">An officer may call this number about your complaint.</p>}
          </div>
          {error && <p className="v-error" role="alert">{error}</p>}
          <button className="cg-btn v-primary v-block" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Continue'}</button>
        </form>
      </main>
      <footer className="v-footer">
        <span>CaseGraph helps you prepare a complaint. It does not replace a police report and cannot get your money back.</span>
        <Link to="/officer">Officer sign-in</Link>
      </footer>
    </div>
  );
}
