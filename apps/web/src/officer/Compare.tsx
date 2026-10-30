import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Brief, OfficerCaseFile, SharedEntity } from '../types.v2';
import { exactTime, formatMoney } from './format';
import { useLoad } from './officerApi';
import { CategoryChip, EntityPill, ErrorState, Icon, Skeleton } from './parts';
import { scoreBand, sortShared } from './Similar';

type Pair = { brief: Brief; shared: SharedEntity[] };

function Hl({ text, terms }: { text: string; terms: string[] }) {
  const valid = terms.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!valid.length) return <>{text}</>;
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Phone numbers may be written with spaces or dashes; match those too.
  const pat = (t: string) => (/^\d{8,}$/.test(t) ? t.split('').map(esc).join('[\\s-]?') : esc(t));
  const re = new RegExp(`(${valid.map(pat).join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="o-mark">{part}</mark> : <Fragment key={i}>{part}</Fragment>))}</>;
}

export function ComparePage() {
  const { caseId = '', otherId = '' } = useParams();
  const mine = useLoad<OfficerCaseFile>(`/officer/cases/${encodeURIComponent(caseId)}`);
  const other = useLoad<Pair>(`/officer/cases/${encodeURIComponent(caseId)}/similar/${encodeURIComponent(otherId)}`);
  const h1 = useRef<HTMLHeadingElement>(null);
  const ready = mine.value.state === 'ready' && other.value.state === 'ready';
  useEffect(() => { if (ready) h1.current?.focus({ preventScroll: true }); }, [ready]);

  const err = mine.value.state === 'error' ? mine.value.message : other.value.state === 'error' ? other.value.message : '';
  return (
    <div className="o-page o-comparepage">
      <nav className="o-crumbs o-noprint" aria-label="Breadcrumb">
        <Link to={`/officer/cases/${caseId}`}><Icon name="back" size={14} /> Back to case file</Link>
      </nav>
      {err && <ErrorState title="The comparison could not be opened" message={err} onRetry={() => { mine.reload(); other.reload(); }} />}
      {!err && !ready && (
        <div aria-busy="true" aria-label="Loading comparison" className="o-stack"><Skeleton h={90} /><Skeleton h={260} /><Skeleton h={260} /></div>
      )}
      {ready && mine.value.state === 'ready' && other.value.state === 'ready' && (
        <Body a={mine.value.data.brief} b={other.value.data.brief} shared={other.value.data.shared}
          meta={mine.value.data.similar.cases.find((c) => c.caseId === otherId)} h1={h1} />
      )}
    </div>
  );
}

function Body({ a, b, shared, meta, h1 }: { a: Brief; b: Brief; shared: SharedEntity[]; meta?: { score: number; reason: string }; h1: React.RefObject<HTMLHeadingElement | null> }) {
  const terms = shared.map((s) => s.value);
  const isShared = (k: string, v: string) => shared.some((s) => s.kind === k && s.value === v);
  const band = meta ? scoreBand(meta.score) : null;
  const Row = ({ label, left, right }: { label: string; left: ReactNode; right: ReactNode }) => (
    <section className="o-cmp__row" aria-label={label}>
      <h2 className="cg-eyebrow o-cmp__label">{label}</h2>
      <div className="o-cmp__cell cg-card">{left}</div>
      <div className="o-cmp__cell cg-card">{right}</div>
    </section>
  );
  const entities = (br: Brief) => br.entities.length === 0 ? <span className="o-muted">None recorded</span> : (
    <div className="o-chiprow">{br.entities.map((e) => {
      const s = shared.find((x) => x.kind === e.kind && x.value === e.value);
      return <EntityPill key={`${e.kind}:${e.value}`} kind={e.kind} value={e.value} strength={s?.strength} extra={s ? 'shared' : undefined} />;
    })}</div>
  );
  const facts = (br: Brief) => br.facts.length === 0 ? <span className="o-muted">None recorded</span> : (
    <dl className="o-facts o-facts--tight">{br.facts.map((f) => (
      <div key={f.id} className="o-fact"><dt>{f.label}</dt><dd><span><Hl text={f.value} terms={terms} /></span></dd></div>
    ))}</dl>
  );
  const timeline = (br: Brief) => br.timeline.length === 0 ? <span className="o-muted">No timeline</span> : (
    <ol className="o-minitl">{br.timeline.map((t) => (
      <li key={t.id}><time className="o-muted">{t.atLabel || 'Date unknown'}</time><strong>{t.title}</strong>{t.detail && <p><Hl text={t.detail} terms={terms} /></p>}</li>
    ))}</ol>
  );
  const head = (br: Brief, which: string) => (
    <>
      <div className="o-casehead__meta"><span className="cg-eyebrow">{which}</span><span className="o-ref mono">{br.reference}</span><CategoryChip id={br.category} label={br.categoryLabel} /></div>
      <h2 className="o-cmp__title">{br.title}</h2>
      <div className="o-muted">Lost <strong className="o-strong">{formatMoney(br.totalLoss)}</strong>{br.timeline[0]?.at && <> &middot; first event {exactTime(br.timeline[0].at)}</>}</div>
    </>
  );
  return (
    <>
      <header className="cg-card o-pad o-cmp__top">
        <h1 ref={h1} tabIndex={-1}>Comparing {a.reference} with {b.reference}</h1>
        {meta && band && <p className="o-reason"><span className={`o-score o-score--${band.tone} o-score--inline`}><strong>{meta.score}</strong><span>/100</span></span> {meta.reason}</p>}
        <div className="o-sharedlabel">Details these two complaints share</div>
        {shared.length === 0 ? <p className="o-muted">No shared details were returned.</p> : (
          <div className="o-chiprow o-chiprow--lg">{sortShared(shared).map((s) => <EntityPill key={`${s.kind}:${s.value}`} kind={s.kind} value={s.value} strength={s.strength} />)}</div>
        )}
        <p className="o-fine">A shared detail is a lead to check. It does not show that the same person is responsible.</p>
      </header>
      <div className="o-cmp">
        <div className="o-cmp__heads">
          <div />
          <div className="o-cmp__cell cg-card o-cmp__headcell">{head(a, 'This complaint')}</div>
          <div className="o-cmp__cell cg-card o-cmp__headcell">{head(b, 'Earlier complaint')}
            <Link className="o-fine" to={`/officer/cases/${b.caseId}`}>Open full case file</Link></div>
        </div>
        <Row label="Summary" left={<p className="o-summary"><Hl text={a.summary} terms={terms} /></p>} right={<p className="o-summary"><Hl text={b.summary} terms={terms} /></p>} />
        <Row label="Phone numbers, accounts and websites" left={entities(a)} right={entities(b)} />
        <Row label="Key facts" left={facts(a)} right={facts(b)} />
        <Row label="Timeline" left={timeline(a)} right={timeline(b)} />
      </div>
    </>
  );
}
