import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OfficerCaseRow } from '../types.v2';
import { CATEGORIES } from '../types.v2';
import { useLoad } from './officerApi';
import { exactTime, formatCompactMoney, formatMoney, isToday, relativeTime } from './format';
import { CategoryChip, ErrorState, Icon, Skeleton } from './parts';

type SortKey = 'newest' | 'loss' | 'similar';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest first' }, { id: 'loss', label: 'Highest loss' }, { id: 'similar', label: 'Most similar cases' },
];

export function filterRows(rows: OfficerCaseRow[], q: string, category: string, sort: SortKey): OfficerCaseRow[] {
  const needle = q.trim().toLowerCase();
  const out = rows.filter((r) => (!category || r.category === category) &&
    (!needle || [r.reference, r.title, r.victimName, r.victimMobileMasked, r.categoryLabel].some((v) => v.toLowerCase().includes(needle))));
  const by: Record<SortKey, (a: OfficerCaseRow, b: OfficerCaseRow) => number> = {
    newest: (a, b) => b.submittedAt.localeCompare(a.submittedAt),
    loss: (a, b) => (b.loss?.amount ?? -1) - (a.loss?.amount ?? -1),
    similar: (a, b) => b.similarCount - a.similarCount || b.submittedAt.localeCompare(a.submittedAt),
  };
  return [...out].sort(by[sort]);
}

function Meter({ percent }: { percent: number }) {
  const tone = percent >= 80 ? 'ok' : percent >= 50 ? 'mid' : 'low';
  return (
    <span className="o-meter" title={`${percent}% of the details we need are in`}>
      <span className="o-meter__track"><span className={`o-meter__fill o-meter__fill--${tone}`} style={{ width: `${percent}%` }} /></span>
      <span className="o-meter__n">{percent}%</span>
      <span className="sr-only">complete</span>
    </span>
  );
}

export function Inbox() {
  const nav = useNavigate();
  const { value, reload } = useLoad<OfficerCaseRow[]>('/officer/cases');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [active, setActive] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const rowsRef = useRef<HTMLTableSectionElement>(null);

  const all = value.state === 'ready' ? value.data : [];
  const rows = useMemo(() => filterRows(all, q, category, sort), [all, q, category, sort]);
  const stats = useMemo(() => ({
    today: all.filter((r) => isToday(r.submittedAt)).length,
    loss: all.reduce((s, r) => s + (r.loss?.amount ?? 0), 0),
    linked: all.filter((r) => r.similarCount > 0).length,
  }), [all]);

  useEffect(() => { setActive(0); }, [q, category, sort]);
  useEffect(() => { rowsRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.matches?.('input, textarea, select, [contenteditable]');
      if (e.key === '/' && !typing) { e.preventDefault(); search.current?.focus(); return; }
      if (e.key === 'Escape' && t === search.current) { setQ(''); search.current?.blur(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0))); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && rows[active] && t.tagName !== 'A' && t.tagName !== 'BUTTON') nav(`/officer/cases/${rows[active]!.id}`);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rows, active, nav]);

  return (
    <div className="o-page">
      <div className="o-pagehead">
        <div>
          <h1>Submitted complaints</h1>
          <p className="o-muted">Review new complaints and see which ones are linked to earlier cases.</p>
        </div>
        <button className="cg-btn cg-btn--ghost cg-btn--sm" onClick={reload}>Refresh</button>
      </div>

      <section className="o-stats" aria-label="Summary">
        <Stat label="New today" value={value.state === 'ready' ? String(stats.today) : null} hint="complaints submitted today" />
        <Stat label="Total reported loss" value={value.state === 'ready' ? formatCompactMoney(stats.loss) : null} hint={`across ${all.length} complaints`} />
        <Stat label="Linked to other cases" value={value.state === 'ready' ? String(stats.linked) : null} hint="share a phone, UPI ID or website" accent />
      </section>

      <div className="o-toolbar" role="search">
        <div className="o-search">
          <Icon name="search" size={16} />
          <input ref={search} type="search" aria-label="Search complaints" placeholder="Search by reference, name, mobile or title" value={q} onChange={(e) => setQ(e.target.value)} />
          <kbd aria-hidden="true">/</kbd>
        </div>
        <select aria-label="Category" className="o-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select aria-label="Sort by" className="o-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {value.state === 'error' && <ErrorState title="The inbox could not be loaded" message={value.message} onRetry={reload} />}

      {value.state !== 'error' && (
        <div className="o-tablewrap cg-card">
          <table className="o-table">
            <caption className="sr-only">Submitted complaints. Use J and K to move, Enter to open.</caption>
            <thead>
              <tr>
                <th scope="col">Complaint</th><th scope="col">Complainant</th><th scope="col" className="o-num">Amount lost</th>
                <th scope="col">Submitted</th><th scope="col">Similar cases</th><th scope="col">Details</th>
              </tr>
            </thead>
            <tbody ref={rowsRef}>
              {value.state === 'loading' && Array.from({ length: 6 }, (_, i) => (
                <tr key={i} aria-hidden="true"><td colSpan={6}><Skeleton h={38} /></td></tr>
              ))}
              {value.state === 'ready' && rows.map((r, i) => (
                <tr key={r.id} data-i={i} className={`o-row ${i === active ? 'is-active' : ''} ${r.similarCount > 0 ? 'is-linked' : ''}`}
                  aria-selected={i === active} onClick={() => nav(`/officer/cases/${r.id}`)} onMouseEnter={() => setActive(i)}>
                  <td>
                    <div className="o-ref mono">{r.reference}</div>
                    <a className="o-title" href={`/officer/cases/${r.id}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav(`/officer/cases/${r.id}`); }}>{r.title}</a>
                    <div className="o-cell-chip"><CategoryChip id={r.category} label={r.categoryLabel} /></div>
                  </td>
                  <td><div className="o-strong">{r.victimName}</div><div className="o-muted mono">{r.victimMobileMasked}</div></td>
                  <td className="o-num o-strong">{formatMoney(r.loss)}</td>
                  <td><time dateTime={r.submittedAt} title={exactTime(r.submittedAt)}>{relativeTime(r.submittedAt)}</time></td>
                  <td>{r.similarCount > 0
                    ? <span className="cg-chip cg-chip--red o-sim"><Icon name="link" size={13} />{r.similarCount} similar {r.similarCount === 1 ? 'case' : 'cases'}</span>
                    : <span className="o-muted">None found</span>}</td>
                  <td><Meter percent={r.completenessPercent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {value.state === 'ready' && rows.length === 0 && (
            <div className="o-state">
              <h3>{all.length === 0 ? 'No complaints yet' : 'No complaints match'}</h3>
              <p>{all.length === 0 ? 'Complaints appear here as soon as people submit them.' : 'Try a different search or clear the category filter.'}</p>
              {all.length > 0 && <button className="cg-btn cg-btn--ghost cg-btn--sm" onClick={() => { setQ(''); setCategory(''); }}>Clear filters</button>}
            </div>
          )}
        </div>
      )}
      <p className="o-hint">Keyboard: <kbd>J</kbd>/<kbd>K</kbd> move, <kbd>Enter</kbd> open, <kbd>/</kbd> search</p>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string | null; hint: string; accent?: boolean }) {
  return (
    <div className={`o-stat cg-card ${accent ? 'o-stat--accent' : ''}`}>
      <div className="cg-eyebrow">{label}</div>
      {value === null ? <Skeleton h={30} w={90} /> : <div className="o-stat__v">{value}</div>}
      <div className="o-muted o-stat__h">{hint}</div>
    </div>
  );
}
