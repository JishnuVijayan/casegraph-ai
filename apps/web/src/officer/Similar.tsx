import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SharedEntity, SimilarCase, SimilarCases } from '../types.v2';
import { KIND_SHORT, exactTime, formatMoney, relativeTime } from './format';
import { CategoryChip, EntityPill, Icon } from './parts';
import { useOfficerApi } from './officerApi';
import { useToast } from './toast';

type Review = 'USEFUL' | 'NOT_RELATED';

export function scoreBand(score: number): { label: string; tone: 'high' | 'mid' | 'low' } {
  if (score >= 70) return { label: 'Strong overlap', tone: 'high' };
  if (score >= 40) return { label: 'Some overlap', tone: 'mid' };
  return { label: 'Weak overlap', tone: 'low' };
}
export function sortShared(list: SharedEntity[]): SharedEntity[] {
  return [...list].sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'STRONG' ? -1 : 1));
}

export function SimilarPanel({ caseId, similar, onRetry, retrying }: { caseId: string; similar: SimilarCases; onRetry: () => void; retrying: boolean }) {
  const { post } = useOfficerApi();
  const toast = useToast();
  const [reviews, setReviews] = useState<Record<string, Review>>({});

  async function review(other: SimilarCase, status: Review) {
    const previous = reviews[other.caseId];
    setReviews((r) => ({ ...r, [other.caseId]: status }));
    try {
      await post(`/officer/cases/${caseId}/similar/${other.caseId}/review`, { status });
      toast(status === 'USEFUL' ? `${other.reference} marked as useful` : `${other.reference} marked as not related`);
    } catch (e) {
      setReviews((r) => { const n = { ...r }; if (previous) n[other.caseId] = previous; else delete n[other.caseId]; return n; });
      toast(e instanceof Error ? e.message : 'Could not save your review.', 'error');
    }
  }

  const cases = [...similar.cases].sort((a, b) => b.score - a.score);
  return (
    <section className="o-similar" aria-labelledby="o-sim-h">
      <div className="o-similar__head">
        <h2 id="o-sim-h">Similar cases</h2>
        {similar.status === 'READY' && <span className="cg-chip cg-chip--red">{cases.length}</span>}
      </div>
      <p className="o-fine">Earlier complaints that share details with this one. These are leads to check, not proof.</p>

      {similar.status === 'UNAVAILABLE' && (
        <div className="o-state o-state--warn" role="status">
          <h3>Case network is offline</h3>
          <p>We could not check for related complaints just now. Nothing has been assumed.</p>
          <button className="cg-btn cg-btn--ghost cg-btn--sm" onClick={onRetry} disabled={retrying}>{retrying ? 'Retrying…' : 'Retry'}</button>
        </div>
      )}
      {similar.status === 'NONE' && (
        <div className="o-state">
          <h3>No earlier complaints share details with this one</h3>
          <p>No matching phone number, UPI ID, account or website was found in submitted complaints.</p>
        </div>
      )}
      {similar.status === 'READY' && cases.length > 0 && (
        <>
          <NetworkGraph caseId={caseId} cases={cases} />
          <ol className="o-simlist">
            {cases.map((c) => {
              const band = scoreBand(c.score);
              const r = reviews[c.caseId];
              return (
                <li key={c.caseId} className={`o-simcard ${r === 'NOT_RELATED' ? 'is-dim' : ''}`}>
                  <div className="o-simcard__top">
                    <div className={`o-score o-score--${band.tone}`} aria-label={`Similarity ${c.score} out of 100, ${band.label}`}>
                      <strong>{c.score}</strong><span>/100</span>
                    </div>
                    <div className="o-simcard__id">
                      <Link className="o-ref mono" to={`/officer/cases/${c.caseId}`} title="Open this case file">{c.reference}</Link>
                      <div className="o-strong">{c.title}</div>
                    </div>
                  </div>
                  <p className="o-reason">{c.reason}</p>
                  <div className="o-sharedlabel">Shares</div>
                  <div className="o-chiprow">
                    {sortShared(c.shared).map((s) => <EntityPill key={`${s.kind}:${s.value}`} kind={s.kind} value={s.value} strength={s.strength} />)}
                  </div>
                  <div className="o-simcard__meta">
                    <CategoryChip id={c.category} label={c.categoryLabel} />
                    <span>{formatMoney(c.loss)}</span>
                    <time dateTime={c.submittedAt} title={exactTime(c.submittedAt)}>{relativeTime(c.submittedAt)}</time>
                  </div>
                  <div className="o-simcard__actions">
                    <Link className="cg-btn cg-btn--soft cg-btn--sm" to={`/officer/cases/${caseId}/compare/${c.caseId}`}>Compare side by side</Link>
                    <button type="button" className={`o-toggle ${r === 'USEFUL' ? 'is-on' : ''}`} aria-pressed={r === 'USEFUL'} onClick={() => review(c, 'USEFUL')}><Icon name="thumb" size={14} /> Useful</button>
                    <button type="button" className={`o-toggle ${r === 'NOT_RELATED' ? 'is-on is-off' : ''}`} aria-pressed={r === 'NOT_RELATED'} onClick={() => review(c, 'NOT_RELATED')}><Icon name="off" size={14} /> Not related</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

const short = (ref: string) => ref.replace(/^CG-/, '');

export function NetworkGraph({ caseId, cases }: { caseId: string; cases: SimilarCase[] }) {
  const shown = cases.slice(0, 6);
  const W = 420, H = shown.length <= 2 ? 170 : 320, cx = W / 2, cy = H / 2, rx = 150, ry = shown.length <= 2 ? 0 : 105;
  const pos = shown.map((_, i) => {
    const a = (shown.length <= 2 ? 0 : -Math.PI / 2) + (i * 2 * Math.PI) / shown.length;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  return (
    <figure className="o-net">
      <figcaption>
        <span className="cg-eyebrow">Case network</span>
        <span className="o-fine">Leads only. A link means a shared detail, not that the cases are connected.</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Case network: this complaint and ${shown.length} similar ${shown.length === 1 ? 'case' : 'cases'}`}>
        {shown.map((c, i) => {
          const p = pos[i]!;
          const strong = c.shared.some((s) => s.strength === 'STRONG');
          const kinds = [...new Set(sortShared(c.shared).map((s) => KIND_SHORT[s.kind]))].join(' + ');
          const mx = (cx + p.x) / 2, my = (cy + p.y) / 2;
          return (
            <g key={c.caseId}>
              <line x1={cx} y1={cy} x2={p.x} y2={p.y} className={strong ? 'o-net__edge' : 'o-net__edge o-net__edge--weak'} />
              <g transform={`translate(${mx} ${my})`}>
                <rect x={-(kinds.length * 3.2 + 8)} y={-9} width={kinds.length * 6.4 + 16} height={18} rx={9} className="o-net__tag" />
                <text textAnchor="middle" y={4} className="o-net__tagtext">{kinds}</text>
              </g>
            </g>
          );
        })}
        {shown.map((c, i) => {
          const p = pos[i]!;
          return (
            <Link key={c.caseId} to={`/officer/cases/${caseId}/compare/${c.caseId}`} aria-label={`Compare with ${c.reference}`}>
              <g className="o-net__node" transform={`translate(${p.x} ${p.y})`}>
                <circle r={26} className={`o-net__dot o-net__dot--${scoreBand(c.score).tone}`} />
                <text textAnchor="middle" y={-2} className="o-net__score">{c.score}</text>
                <text textAnchor="middle" y={10} className="o-net__sub">score</text>
                <text textAnchor="middle" y={44} className="o-net__ref">{short(c.reference)}</text>
              </g>
            </Link>
          );
        })}
        <g transform={`translate(${cx} ${cy})`}>
          <circle r={34} className="o-net__center" />
          <text textAnchor="middle" y={-2} className="o-net__centertext">This</text>
          <text textAnchor="middle" y={12} className="o-net__centertext">complaint</text>
        </g>
      </svg>
      {cases.length > shown.length && <div className="o-fine">Showing the {shown.length} closest of {cases.length}. All are listed below.</div>}
    </figure>
  );
}
