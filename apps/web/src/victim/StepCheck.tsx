import { useEffect, useId, useState } from 'react';
import { CATEGORIES, type Brief, type CategoryId, type Fact, type TimelineItem } from '../types.v2';
import { AlertIcon, CheckIcon, PhoneIcon, RefreshIcon, SparkIcon } from './icons';
import { inr, SOURCE_LABEL, SOURCE_TONE } from './format';

const GROUPS: { id: Fact['group']; label: string }[] = [
  { id: 'money', label: 'Money' }, { id: 'people', label: 'People' }, { id: 'channels', label: 'How they reached you' },
  { id: 'accounts', label: 'Accounts and numbers' }, { id: 'time', label: 'Dates and times' }, { id: 'other', label: 'Other details' },
];

export function SourceChip({ type, label }: { type: 'FILE' | 'STORY' | 'AI'; label?: string }) {
  return <span className={`cg-chip cg-chip--${SOURCE_TONE[type]} v-src`} title={label}>{label || SOURCE_LABEL[type]}</span>;
}

const STAGES = ['Reading your files', 'Building your timeline', 'Finding what is missing'];

/** Friendly 3-stage progress. Stages are a gentle guide; the real work can take up to 40 seconds. */
export function AnalysisProgress() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const t = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  const stage = seconds < 6 ? 0 : seconds < 14 ? 1 : 2;
  return (
    <div className="v-progress" aria-busy="true">
      <h1 className="v-h1" tabIndex={-1}>Putting your story together</h1>
      <p className="v-lead">This can take up to a minute. Please keep this page open.</p>
      <p className="sr-only" role="status" aria-live="polite">{STAGES[stage]}…</p>
      <ol className="v-stages">
        {STAGES.map((s, i) => (
          <li key={s} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''}>
            <span className="v-stage-mark" aria-hidden="true">{i < stage ? <CheckIcon size={14} /> : i === stage ? <span className="v-spin" /> : ''}</span>
            <span>{s}{i === stage ? '…' : ''}</span>
          </li>
        ))}
      </ol>
      <div className="v-skel" aria-hidden="true">
        <div className="cg-skeleton" style={{ height: 22, width: '60%' }} />
        <div className="cg-skeleton" style={{ height: 14 }} /><div className="cg-skeleton" style={{ height: 14, width: '90%' }} />
        <div className="cg-skeleton" style={{ height: 78, marginTop: 8 }} /><div className="cg-skeleton" style={{ height: 78 }} />
      </div>
    </div>
  );
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="v-timeline">
      {items.map((t) => (
        <li key={t.id} className={`v-tl v-tl--${t.kind}`}>
          <span className="v-tl-dot" aria-hidden="true">{t.kind === 'contact' ? <PhoneIcon size={13} /> : t.kind === 'payment' ? '₹' : ''}</span>
          <div className="v-tl-card">
            <p className="v-tl-when">{t.atLabel || 'Date not known'}{t.precision === 'APPROXIMATE' && <span className="v-approx"> · approximate</span>}</p>
            <p className="v-tl-title">{t.title}</p>
            {t.detail && <p className="v-tl-detail">{t.detail}</p>}
            <div className="v-tl-src">
              {t.sources.map((s, i) => <SourceChip key={i} type={s.type} label={s.label && s.type === 'FILE' ? `${SOURCE_LABEL.FILE}: ${s.label}` : undefined} />)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Facts({ facts }: { facts: Fact[] }) {
  return (
    <div className="v-facts">
      {GROUPS.map((g) => {
        const rows = facts.filter((f) => f.group === g.id);
        if (!rows.length) return null;
        return (
          <section key={g.id} className="v-fact-group" aria-label={g.label}>
            <h3 className="cg-eyebrow">{g.label}</h3>
            <dl>
              {rows.map((f) => (
                <div key={f.id} className="v-fact">
                  <dt>{f.label}</dt>
                  <dd><span className="v-fact-val">{f.value}</span><SourceChip type={f.source} /></dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

type Props = {
  brief: Brief; analyzing: boolean; error: string; openQuestions: number;
  onCategory: (id: CategoryId) => void; onRetry: () => void;
  onNext: () => void; onAddMore: () => void; onFix: () => void; onQuestions: () => void;
};

/** Step 2. Show what AI understood; one clear way forward. */
export function StepCheck(p: Props) {
  const { brief } = p;
  const selectId = useId();
  const hasContent = !!brief.summary || brief.timeline.length > 0 || brief.facts.length > 0;
  // First reading shows the full progress screen. Later updates (after answers) keep the story on screen with a small note.
  if (p.analyzing && !hasContent) return <div className="v-screen"><AnalysisProgress /></div>;
  if (p.error) {
    return (
      <>
        <div className="v-screen">
          <h1 className="v-h1" tabIndex={-1}>We could not finish just now</h1>
          <div className="v-banner" role="alert">
            <AlertIcon size={20} />
            <div><p><strong>{p.error}</strong></p><p className="v-muted">Nothing you added is lost. Please try again.</p></div>
          </div>
        </div>
        <div className="v-actionbar v-actionbar--pair">
          <button type="button" className="cg-btn cg-btn--ghost v-secondary" onClick={p.onAddMore}>Go back</button>
          <button type="button" className="cg-btn v-primary" onClick={p.onRetry}><RefreshIcon size={18} /> Try again</button>
        </div>
      </>
    );
  }
  const loss = inr(brief.totalLoss);
  const empty = !brief.summary && !brief.timeline.length && !brief.facts.length;
  return (
    <>
      <div className="v-screen">
        <h1 className="v-h1" tabIndex={-1}>Check your story</h1>
        <p className="v-lead">This is what we understood. Is it right?</p>
        {p.analyzing && <p className="v-note" role="status" aria-live="polite"><span className="v-spin" aria-hidden="true" /> Updating with your latest answers&hellip;</p>}

        {empty ? (
          <div className="v-empty"><p><strong>We could not find details yet.</strong></p>
            <p className="v-muted">Add more about what happened, or a screenshot, and we will try again.</p></div>
        ) : (
          <>
            <section className="v-card v-summary-card" aria-label="Summary">
              <div className="v-top">
                <div>
                  <p className="v-loss-label">Money lost</p>
                  <p className="v-loss-amt">{loss ?? 'None told'}</p>
                </div>
                <div className="v-cat">
                  <label htmlFor={selectId} className="v-loss-label">Type of crime</label>
                  <select id={selectId} className="v-chip-select" value={brief.category} onChange={(e) => p.onCategory(e.target.value as CategoryId)}>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              {brief.summary && (
                <div className="v-summary">
                  <h2 className="cg-eyebrow"><SparkIcon size={14} /> In short <SourceChip type="AI" label="Written by AI" /></h2>
                  <p>{brief.summary}</p>
                </div>
              )}
            </section>

            <h2 className="v-h2">What happened, in order</h2>
            {brief.timeline.length
              ? <Timeline items={brief.timeline} />
              : <p className="v-muted">We could not find any dates yet. If you remember when it happened, add it and we will update this.</p>}

            {brief.facts.length > 0 && (<><h2 className="v-h2">Key details</h2><Facts facts={brief.facts} /></>)}
            {p.openQuestions > 0 && (
              <p className="v-note">
                {p.openQuestions === 1 ? '1 question is still open' : `${p.openQuestions} questions are still open`}. Answering helps the officer, but you can skip.{' '}
                <button type="button" className="v-link" onClick={p.onQuestions}>Answer now</button>
              </p>
            )}
            <p className="v-fix"><button type="button" className="v-link" onClick={p.onFix}>Something wrong? Tell us</button></p>
          </>
        )}
      </div>
      <div className="v-actionbar v-actionbar--pair">
        <button type="button" className="cg-btn cg-btn--ghost v-secondary" onClick={p.onAddMore}>Add more details</button>
        <button type="button" className="cg-btn v-primary" disabled={empty || p.analyzing} onClick={p.onNext}>This looks right, continue</button>
      </div>
    </>
  );
}
