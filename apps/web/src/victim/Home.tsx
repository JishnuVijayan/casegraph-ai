import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api';
import type { CaseListItem, Session } from '../types.v2';
import { HelpStrip } from './HelpStrip';
import { ChevronRight, PlusIcon } from './icons';
import { ago } from './format';

export function Home({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<CaseListItem[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setItems(await api<CaseListItem[]>('/cases', session.token)); }
    catch (f) { setError(errorMessage(f)); setItems([]); }
  }, [session.token]);
  useEffect(() => { void load(); }, [load]);

  async function start() {
    setCreating(true); setError('');
    try {
      const created = await api<{ id: string }>('/cases', session.token, {}, 'POST');
      navigate(`/complaint/${created.id}`);
    } catch (f) { setError(errorMessage(f)); setCreating(false); }
  }

  const first = session.user.displayName.split(' ')[0];
  const hasAny = !!items && items.length > 0;
  return (
    <div className="v-page">
      <HelpStrip />
      <header className="v-bar">
        <p className="v-brand v-brand--dark"><span className="v-brand-mark" aria-hidden="true" />CaseGraph</p>
        <button type="button" className="cg-btn cg-btn--ghost cg-btn--sm" onClick={onSignOut}>Sign out</button>
      </header>
      <main className="v-main">
        <h1 className="v-h1">Hello, {first}</h1>
        <p className="v-lead">{hasAny ? 'Carry on where you stopped, or start a new complaint.' : 'You are in the right place. It only takes a few simple steps.'}</p>
        <button type="button" className="cg-btn v-primary v-start-btn" onClick={() => void start()} disabled={creating}>
          <PlusIcon size={20} /> {creating ? 'Opening…' : 'Start a new complaint'}
        </button>
        {error && <p className="v-error" role="alert">{error} <button type="button" className="v-link" onClick={() => void load()}>Try again</button></p>}

        <h2 className="v-h2">My complaints</h2>
        {items === null && <div aria-busy="true" aria-label="Loading your complaints"><div className="cg-skeleton v-sk-row" /><div className="cg-skeleton v-sk-row" /></div>}
        {items && items.length === 0 && !error && (
          <div className="v-empty"><p><strong>No complaints yet.</strong></p><p className="v-muted">When you start one, it is saved on its own and shows up here.</p></div>
        )}
        {hasAny && (
          <ul className="v-list">
            {items.map((c) => {
              const submitted = c.status === 'SUBMITTED';
              return (
                <li key={c.id}>
                  <Link className="v-case-card" to={`/complaint/${c.id}`}>
                    <span className="v-case-top">
                      <span className="v-case-title">{c.title || 'New complaint'}</span>
                      <span className={`cg-chip ${submitted ? 'cg-chip--green' : 'cg-chip--amber'}`}>{submitted ? 'Submitted' : 'Draft'}</span>
                    </span>
                    <span className="v-case-meta">{c.reference} · Updated {ago(c.updatedAt) || 'recently'}</span>
                    <span className="v-case-go">{submitted ? 'View' : 'Continue'} <ChevronRight size={16} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
