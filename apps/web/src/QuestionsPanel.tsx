import { useEffect, useRef, useState } from 'react';
import { api } from './api';

type Question = {
  id: string; prompt: string; status: string; isCurrent: boolean;
  context: { eventId: string; claims: { id: string; rawValue: string; sourceKind: string }[] };
  answer: { text: string | null } | null;
};

export function QuestionsPanel({ token, caseId, owner, busy, perform, autoRefresh = false, compact = false }: {
  token: string; caseId: string; owner: boolean; busy: boolean;
  perform: (operation: () => Promise<void>) => Promise<void>;
  autoRefresh?: boolean; compact?: boolean;
}) {
  const [rows, setRows] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const next = rows.find((q) => q.isCurrent && q.status === 'OPEN');
  const performRef = useRef(perform);
  useEffect(() => { performRef.current = perform; });

  async function load(refresh: boolean) {
    setRows([]); setLoaded(false);
    const result = await api<Question[]>(
      `/cases/${caseId}/clarifications${refresh ? '/refresh' : ''}`,
      token,
      refresh ? {} : undefined,
      refresh ? 'POST' : 'GET',
    );
    setRows(result); setLoaded(true); setText('');
  }

  useEffect(() => {
    if (!autoRefresh || !owner) return;
    // Victim prepare already refreshed; load current list only.
    void performRef.current(() => load(compact ? false : true));
  }, [autoRefresh, owner, caseId, token, compact]);

  async function answer(status: 'UNKNOWN' | 'ANSWERED') {
    if (!next) return;
    const id = next.id;
    setRows([]); setLoaded(false);
    await api(`/cases/${caseId}/clarifications/${id}/answer`, token, {
      status,
      ...(status === 'ANSWERED' ? { text } : {}),
    }, 'POST');
    await load(false);
  }

  return (
    <section className={compact ? 'panel-block' : undefined} aria-label="Clarification questions">
      {!compact && <h3 className="text-lg font-bold m-0">Fill in missing details</h3>}
      {!compact && (
        <p className="mt-2" style={{ color: 'var(--muted)' }}>
          Answer focused questions about payment amounts, references, or timing. You can mark a detail unknown.
        </p>
      )}
      {!compact && (
        <button className="btn-ghost" disabled={busy} onClick={() => void perform(() => load(owner))}>
          {owner ? 'Check payment details for questions' : 'Read clarification history'}
        </button>
      )}
      {loaded && !next && (
        <p className="empty-hint empty-hint-ok">
          {compact ? 'Nothing else is missing — you can submit.' : 'No current unanswered questions.'}
        </p>
      )}
      {next && (
        <form className="question-card" onSubmit={(event) => { event.preventDefault(); void perform(() => answer('ANSWERED')); }}>
          <p className="question-prompt">{next.prompt}</p>
          {!compact && <p className="evidence-meta">Payment event: {next.context.eventId}</p>}
          {!compact && (
            <ul className="claim-chip-list">
              {next.context.claims.map((c) => (
                <li key={c.id} className="claim-chip">
                  {c.rawValue} · {c.sourceKind} · UNVERIFIED
                </li>
              ))}
            </ul>
          )}
          {owner && (
            <>
              <label htmlFor="clarification-answer">{compact ? 'Your answer' : 'Your recollection'}</label>
              <input
                id="clarification-answer"
                value={text}
                required
                maxLength={500}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="action-row">
                <button className="btn-primary" type="submit" disabled={busy}>
                  {compact ? 'Save answer' : 'Save recollection'}
                </button>
                <button className="btn-ghost" type="button" disabled={busy} onClick={() => void perform(() => answer('UNKNOWN'))}>
                  {compact ? 'I don’t remember' : 'Unknown / I can’t remember'}
                </button>
              </div>
            </>
          )}
        </form>
      )}
      {!compact && rows.some((q) => q.status !== 'OPEN' || !q.isCurrent) && (
        <details className="history-details">
          <summary>Previous questions and answers</summary>
          <ul>
            {rows.filter((q) => q.status !== 'OPEN' || !q.isCurrent).map((q) => (
              <li key={q.id}>
                {q.prompt} · {q.status}{!q.isCurrent && ' · Superseded by changed payment details'}
                {q.answer && (
                  <p>
                    {q.status === 'UNKNOWN' ? 'Unknown / I can’t remember' : q.answer.text}
                    {' · VICTIM_RECOLLECTION · UNVERIFIED'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
