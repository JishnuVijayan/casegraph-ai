import type { Brief, Fact, SimilarCase, TimelineItem } from '../types.v2';
import { KIND_LABEL } from './format';
import { CopyButton, EntityPill } from './parts';

const GROUPS: { id: Fact['group']; label: string }[] = [
  { id: 'money', label: 'Money' }, { id: 'people', label: 'People' }, { id: 'channels', label: 'How they made contact' },
  { id: 'accounts', label: 'Accounts' }, { id: 'time', label: 'When' }, { id: 'other', label: 'Other details' },
];
export const SOURCE_LABEL = { FILE: 'Read from files', STORY: 'What the complainant told us', AI: 'Worked out by AI' } as const;

export function sharedCounts(similar: SimilarCase[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of similar) for (const s of c.shared) m.set(`${s.kind}:${s.value}`, (m.get(`${s.kind}:${s.value}`) ?? 0) + 1);
  return m;
}

export function Overview({ brief, similar, onOpenFile }: { brief: Brief; similar: SimilarCase[]; onOpenFile: (id: string) => void }) {
  const counts = sharedCounts(similar);
  return (
    <div className="o-stack">
      <section className="cg-card o-pad" aria-labelledby="o-sum-h">
        <div className="o-secthead"><h2 id="o-sum-h">Summary</h2><span className="cg-chip cg-chip--blue">Written by AI</span></div>
        <p className="o-summary">{brief.summary || 'No summary has been written yet.'}</p>
        <p className="o-fine">Check the summary against the evidence before relying on it.</p>
        {brief.completeness.missing.length > 0 && (
          <div className="o-missing">
            <strong>Not provided by the complainant</strong>
            <ul>{brief.completeness.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="cg-card o-pad" aria-labelledby="o-ent-h">
        <div className="o-secthead"><h2 id="o-ent-h">Phone numbers, accounts and websites</h2></div>
        {brief.entities.length === 0 ? <p className="o-muted">No identifying details were found.</p> : (
          <div className="o-chiprow o-chiprow--lg">
            {brief.entities.map((e) => {
              const n = counts.get(`${e.kind}:${e.value}`);
              return <EntityPill key={`${e.kind}:${e.value}`} kind={e.kind} value={e.value} strength={n ? 'STRONG' : undefined}
                extra={n ? `in ${n} other ${n === 1 ? 'case' : 'cases'}` : undefined} />;
            })}
          </div>
        )}
        <p className="o-fine">Select a detail to copy it. Highlighted details also appear in other complaints.</p>
      </section>

      <section className="cg-card o-pad" aria-labelledby="o-facts-h">
        <div className="o-secthead"><h2 id="o-facts-h">Key facts</h2></div>
        {brief.facts.length === 0 ? <p className="o-muted">No facts have been recorded.</p> : GROUPS.map((g) => {
          const facts = brief.facts.filter((f) => f.group === g.id);
          if (!facts.length) return null;
          return (
            <div key={g.id} className="o-factgroup">
              <h3 className="cg-eyebrow">{g.label}</h3>
              <dl className="o-facts">
                {facts.map((f) => (
                  <div key={f.id} className="o-fact">
                    <dt>{f.label}</dt>
                    <dd>
                      <span>{f.value}</span>
                      {f.evidenceId
                        ? <button type="button" className="o-src o-src--link" onClick={() => onOpenFile(f.evidenceId!)} title="Open the file this came from">{SOURCE_LABEL[f.source]}</button>
                        : <span className="o-src">{SOURCE_LABEL[f.source]}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function Timeline({ items, onOpenFile }: { items: TimelineItem[]; onOpenFile: (id: string) => void }) {
  if (!items.length) return <div className="o-state"><h3>No timeline yet</h3><p>There were not enough dates in the complaint to build one.</p></div>;
  return (
    <ol className="o-timeline" aria-label="Timeline of events">
      {items.map((t) => (
        <li key={t.id} className={`o-tl o-tl--${t.kind}`}>
          <div className="o-tl__when">
            <time dateTime={t.at ?? undefined}>{t.atLabel || 'Date unknown'}</time>
            {t.precision !== 'EXACT' && <span className="o-fine">{t.precision === 'APPROXIMATE' ? 'approximate' : t.precision === 'DATE_ONLY' ? 'date only' : 'date not known'}</span>}
          </div>
          <div className="o-tl__body cg-card">
            <h3>{t.title}</h3>
            {t.detail && <p>{t.detail}</p>}
            <div className="o-chiprow">
              {t.sources.map((s, i) => s.evidenceId
                ? <button key={i} type="button" className="o-src o-src--link" onClick={() => onOpenFile(s.evidenceId!)}>{s.label}</button>
                : <span key={i} className="o-src">{s.type === 'STORY' ? 'Complainant’s account' : s.type === 'AI' ? 'Worked out by AI' : s.label}</span>)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Answers({ brief }: { brief: Brief }) {
  return (
    <div className="o-stack">
      <section className="cg-card o-pad" aria-labelledby="o-qa-h">
        <div className="o-secthead"><h2 id="o-qa-h">Questions we asked</h2></div>
        {brief.questions.length === 0 ? <p className="o-muted">No follow-up questions were needed.</p> : (
          <ul className="o-qa">
            {brief.questions.map((q) => {
              const answered = q.status === 'ANSWERED' && q.answer;
              return (
                <li key={q.id}>
                  <div className="o-qa__q">{q.prompt}</div>
                  <div className={answered ? 'o-qa__a' : 'o-qa__a o-qa__a--none'}>{answered ? q.answer : 'Not provided'}</div>
                  <div className="o-fine">{q.why}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="cg-card o-pad" aria-labelledby="o-words-h">
        <div className="o-secthead"><h2 id="o-words-h">In the complainant&rsquo;s own words</h2></div>
        {brief.narratives.length === 0 ? <p className="o-muted">No written or spoken account was added.</p> : (
          <ul className="o-narr">
            {brief.narratives.map((n) => (
              <li key={n.id}>
                <div className="o-fine">{n.channel === 'voice' ? 'Spoken' : 'Typed'} &middot; {new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                <blockquote>{n.text}</blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ContactLine({ label, value }: { label: string; value: string }) {
  return <span className="o-contact"><span className="o-muted">{label}</span> <span className="o-strong">{value}</span> <CopyButton value={value} label={label.toLowerCase()} /></span>;
}
