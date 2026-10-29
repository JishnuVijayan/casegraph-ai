import { useState } from 'react';
import { api } from './api';

type Question = {
  id: string; prompt: string; status: string; isCurrent: boolean;
  context: { eventId: string; claims: { id: string; rawValue: string; sourceKind: string }[] };
  answer: { text: string | null } | null;
};

export function QuestionsPanel({ token, caseId, owner, busy, perform }: {
  token: string; caseId: string; owner: boolean; busy: boolean;
  perform: (operation: () => Promise<void>) => Promise<void>;
}) {
  const [rows, setRows] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const next = rows.find((q) => q.isCurrent && q.status === 'OPEN');

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
    <section aria-label="Clarification questions">
      <h3 className="text-lg font-bold m-0">Fill in missing details</h3>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>
        Answer focused questions about payment amounts, references, or timing. You can mark a detail unknown.
      </p>
      <button disabled={busy} onClick={() => void perform(() => load(owner))}>
        {owner ? 'Check payment details for questions' : 'Read clarification history'}
      </button>
      {loaded && !next && <p>No current unanswered questions.</p>}
      {next && (
        <form onSubmit={(event) => { event.preventDefault(); void perform(() => answer('ANSWERED')); }}>
          <p>{next.prompt}</p>
          <p>Payment event: {next.context.eventId}</p>
          <ul>
            {next.context.claims.map((c) => (
              <li key={c.id}>Claim {c.id}: {c.rawValue} · {c.sourceKind} · UNVERIFIED</li>
            ))}
          </ul>
          {owner && (
            <>
              <label htmlFor="clarification-answer">Your recollection</label>
              <input
                id="clarification-answer"
                value={text}
                required
                maxLength={500}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="btn-primary" type="submit" disabled={busy}>Save recollection</button>
              <button type="button" disabled={busy} onClick={() => void perform(() => answer('UNKNOWN'))}>
                Unknown / I can’t remember
              </button>
            </>
          )}
        </form>
      )}
      {rows.some((q) => q.status !== 'OPEN' || !q.isCurrent) && (
        <details>
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
