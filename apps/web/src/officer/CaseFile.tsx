import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { OfficerCaseFile } from '../types.v2';
import { exactTime, formatMoney } from './format';
import { useLoad, useOfficerApi } from './officerApi';
import { CategoryChip, ErrorState, Icon, Skeleton } from './parts';
import { EvidenceGrid, Lightbox } from './Evidence';
import { Answers, ContactLine, Overview, Timeline } from './Sections';
import { SimilarPanel } from './Similar';
import { useToast } from './toast';

const TABS = [
  { id: 'overview', label: 'Overview' }, { id: 'timeline', label: 'Timeline' },
  { id: 'evidence', label: 'Evidence' }, { id: 'answers', label: 'Complainant’s answers' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function useDossier(caseId: string, reference: string) {
  const { blob } = useOfficerApi();
  const toast = useToast();
  const [busy, setBusy] = useState<'' | 'open' | 'download' | 'print'>('');
  async function run(mode: 'open' | 'download' | 'print') {
    setBusy(mode);
    try {
      const raw = await blob(`/officer/cases/${caseId}/dossier.html`);
      let html = await raw.text();
      if (mode === 'print') html += '<script>addEventListener("load",function(){setTimeout(function(){print()},400)})</script>';
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      if (mode === 'download') {
        const a = document.createElement('a'); a.href = url; a.download = `dossier-${reference}.html`; document.body.appendChild(a); a.click(); a.remove();
        toast('Dossier downloaded');
      } else if (!window.open(url, '_blank')) {
        toast('Your browser blocked the new tab. Allow pop-ups for this site and try again.', 'error');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The dossier could not be prepared.', 'error');
    } finally { setBusy(''); }
  }
  return { busy, run };
}

export function CaseFile() {
  const { caseId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { value, reload } = useLoad<OfficerCaseFile>(`/officer/cases/${encodeURIComponent(caseId)}`);
  const [viewer, setViewer] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const h1 = useRef<HTMLHeadingElement>(null);
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'overview') as TabId;
  const data = value.state === 'ready' ? value.data : null;
  const dossier = useDossier(caseId, data?.brief.reference ?? caseId);

  useEffect(() => { if (data) h1.current?.focus({ preventScroll: true }); }, [data?.brief.caseId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (value.state === 'ready') setRetrying(false); }, [value]);

  function selectTab(id: TabId) { setParams(id === 'overview' ? {} : { tab: id }, { replace: true }); }
  function onTabKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); selectTab(TABS[next]!.id);
    document.getElementById(`o-tab-${TABS[next]!.id}`)?.focus();
  }

  return (
    <div className="o-page o-casepage">
      <nav className="o-crumbs o-noprint" aria-label="Breadcrumb">
        <Link to="/officer"><Icon name="back" size={14} /> Submitted complaints</Link>
      </nav>

      {value.state === 'loading' && <CaseSkeleton />}
      {value.state === 'error' && <ErrorState title="This case file could not be opened" message={value.message} onRetry={reload} />}

      {data && (() => {
        const { brief, victim, similar } = data;
        const counts = similar.cases.length;
        return (
          <>
            <header className="o-casehead cg-card">
              <div className="o-casehead__main">
                <div className="o-casehead__meta">
                  <span className="o-ref mono">{brief.reference}</span>
                  <span className="cg-chip cg-chip--green">Submitted</span>
                  <CategoryChip id={brief.category} label={brief.categoryLabel} />
                  {counts > 0 && <span className="cg-chip cg-chip--red"><Icon name="link" size={13} />{counts} similar {counts === 1 ? 'case' : 'cases'}</span>}
                </div>
                <h1 ref={h1} tabIndex={-1}>{brief.title}</h1>
                <div className="o-contacts">
                  <ContactLine label="Name" value={victim.name} />
                  <ContactLine label="Mobile" value={victim.mobile} />
                  <span className="o-muted" title={brief.analysis.updatedAt ? exactTime(brief.analysis.updatedAt) : undefined}>
                    Details completeness <strong>{brief.completeness.percent}%</strong>
                  </span>
                </div>
              </div>
              <div className="o-casehead__side">
                <div className="o-loss"><span className="cg-eyebrow">Amount lost</span><strong>{formatMoney(brief.totalLoss)}</strong></div>
                <div className="o-actions o-noprint">
                  <button className="cg-btn cg-btn--sm" onClick={() => dossier.run('open')} disabled={!!dossier.busy}><Icon name="external" size={15} /> {dossier.busy === 'open' ? 'Preparing…' : 'Open dossier'}</button>
                  <button className="cg-btn cg-btn--ghost cg-btn--sm" onClick={() => dossier.run('download')} disabled={!!dossier.busy}><Icon name="download" size={15} /> Download</button>
                  <button className="cg-btn cg-btn--ghost cg-btn--sm" onClick={() => dossier.run('print')} disabled={!!dossier.busy}><Icon name="print" size={15} /> Print</button>
                </div>
              </div>
            </header>

            <div className="o-cols">
              <div className="o-colmain">
                <div className="o-tabs o-noprint" role="tablist" aria-label="Case file sections">
                  {TABS.map((t, i) => {
                    const n = t.id === 'timeline' ? brief.timeline.length : t.id === 'evidence' ? brief.evidence.length : t.id === 'answers' ? brief.questions.length : null;
                    return (
                      <button key={t.id} id={`o-tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`o-panel-${t.id}`}
                        tabIndex={tab === t.id ? 0 : -1} className="o-tab" onClick={() => selectTab(t.id)} onKeyDown={(e) => onTabKey(e, i)}>
                        {t.label}{n !== null && <span className="o-tab__n">{n}</span>}
                      </button>
                    );
                  })}
                </div>
                <div id={`o-panel-${tab}`} role="tabpanel" aria-labelledby={`o-tab-${tab}`} className="o-panel">
                  {tab === 'overview' && <Overview brief={brief} similar={similar.cases} onOpenFile={setViewer} />}
                  {tab === 'timeline' && <Timeline items={brief.timeline} onOpenFile={setViewer} />}
                  {tab === 'evidence' && <EvidenceGrid caseId={caseId} items={brief.evidence} onOpen={setViewer} />}
                  {tab === 'answers' && <Answers brief={brief} />}
                </div>
              </div>
              <aside className="o-colside" aria-label="Similar cases">
                <SimilarPanel caseId={caseId} similar={similar} retrying={retrying} onRetry={() => { setRetrying(true); reload(); }} />
              </aside>
            </div>

            {viewer && brief.evidence.some((e) => e.id === viewer) && (
              <Lightbox caseId={caseId} items={brief.evidence} startId={viewer} onClose={() => setViewer(null)} />
            )}
          </>
        );
      })()}
    </div>
  );
}

function CaseSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading case file">
      <div className="cg-card o-pad o-stack"><Skeleton h={14} w={180} /><Skeleton h={32} w="60%" /><Skeleton h={16} w={280} /></div>
      <div className="o-cols" style={{ marginTop: 16 }}>
        <div className="o-colmain o-stack"><Skeleton h={44} /><Skeleton h={180} /><Skeleton h={220} /></div>
        <div className="o-colside o-stack"><Skeleton h={260} /><Skeleton h={160} /></div>
      </div>
    </div>
  );
}
