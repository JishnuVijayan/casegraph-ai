import { useEffect, useRef, useState } from 'react';
import { AnalystPanel } from './AnalystPanel';
import { EvidencePanel } from './EvidencePanel';
import { ExportPanel } from './ExportPanel';
import { QuestionsPanel } from './QuestionsPanel';
import { ReviewPanel } from './ReviewPanel';
import { api, ApiFailure } from './api';
import type { CaseDetail } from './types';

type Evidence = { id: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string };
type Claim = { id: string; type: string; rawValue: string; sourceKind: string; verificationStatus: string };
type TimelineEvent = {
  id: string; eventType: string; occurredAt: string | null; precision: string; uncertainty: string;
  claims: { claimId: string; type: string; rawValue: string }[];
};
type Clarification = {
  id: string; prompt: string; status: string; isCurrent: boolean;
  answer: { text: string | null; status?: string } | null;
};
type Lead = {
  id: string; createdAt: string; reviewStatus: string; classification: string;
  path: {
    source_case_id: string; source_vpa_id: string; account_id: string;
    target_vpa_id: string; target_case_id: string; data_origin: string;
    source_kind: string; verification_status: string;
  };
};
type ExportRow = { id: string; version: number; sha256: string | null; createdAt: string };

export function OfficerCaseReport({ token, detail, busy, perform }: {
  token: string; detail: CaseDetail; busy: boolean;
  perform: (operation: () => Promise<void>) => Promise<void>;
}) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [questions, setQuestions] = useState<Clarification[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsNotice, setLeadsNotice] = useState('');
  const [leadsError, setLeadsError] = useState('');
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [draftHtml, setDraftHtml] = useState('');
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const printRef = useRef<HTMLIFrameElement>(null);

  const performRef = useRef(perform);
  performRef.current = perform;

  useEffect(() => {
    void performRef.current(async () => {
      setEvidence([]); setClaims([]); setTimeline([]); setQuestions([]);
      setLeads([]); setLeadsNotice(''); setLeadsError('');
      setExports([]); setDraftHtml(''); setDraftVersion(null);

      let graphUnavailable = '';
      const [files, claimRows, events, clarifications, leadRows, exportRows] = await Promise.all([
        api<Evidence[]>(`/cases/${detail.id}/evidence`, token),
        api<Claim[]>(`/cases/${detail.id}/claims`, token),
        api<TimelineEvent[]>(`/cases/${detail.id}/timeline`, token),
        api<Clarification[]>(`/cases/${detail.id}/clarifications`, token),
        api<Lead[]>(`/investigations/${detail.id}/graph-leads`, token).catch((failure) => {
          // Leads are optional for the report package; never block screenshots/draft on graph scope.
          if (failure instanceof ApiFailure && (failure.status === 503 || failure.status === 403)) {
            graphUnavailable = failure.status === 503
              ? 'Similar-case search unavailable until TigerGraph is connected'
              : 'Similar-case leads unavailable for this complaint scope.';
            return [] as Lead[];
          }
          throw failure;
        }),
        api<ExportRow[]>(`/cases/${detail.id}/exports`, token),
      ]);
      setEvidence(files);
      setClaims(claimRows);
      setTimeline(events);
      setQuestions(clarifications.filter((q) => q.isCurrent));
      setLeads(leadRows);
      setLeadsError(graphUnavailable);
      setLeadsNotice(leadRows.length
        ? 'Saved query snapshots (investigative leads only — not proof).'
        : graphUnavailable ? '' : 'No saved similar-case leads for this complaint yet.');
      setExports(exportRows);

      const latest = exportRows[exportRows.length - 1];
      if (latest) {
        const response = await fetch(`/api/v1/cases/${detail.id}/exports/${latest.id}/download`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        if (response.ok) {
          setDraftHtml(await response.text());
          setDraftVersion(latest.version);
        }
      }
    });
  }, [detail.id, token]);

  function printDraft() {
    if (!draftHtml) return;
    const frame = printRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      return;
    }
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return;
    popup.document.open();
    popup.document.write(draftHtml);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  const answered = questions.filter((q) => q.status !== 'OPEN');

  return (
    <article aria-label="Case report" className="officer-report anim-rise">
      <section className="workspace-panel report-header">
        <span className="step-label">Submitted complaint</span>
        <h2 className="text-2xl font-bold m-0">{detail.title}</h2>
        <p className="report-meta">
          {detail.category} · {detail.status} · Reference <code>{detail.id}</code>
        </p>
      </section>

      <section className="workspace-panel" aria-label="Screenshots">
        <h3 className="report-section-title">Screenshots</h3>
        {evidence.length ? (
          <ul className="report-shot-grid">
            {evidence.map((row) => (
              <li key={row.id}>
                <EvidenceThumb token={token} caseId={detail.id} evidenceId={row.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">No screenshots on this complaint.</p>
        )}
      </section>

      <section className="workspace-panel" aria-label="What we know">
        <h3 className="report-section-title">What we know</h3>
        <p className="panel-lead">Claims from uploads and answers. Labels stay unverified — not bank confirmation.</p>
        {timeline.length ? (
          <ul className="report-fact-list">
            {timeline.map((event) => (
              <li key={event.id}>
                <strong>{event.eventType}</strong>
                <span>
                  {event.precision === 'UNKNOWN' || !event.occurredAt
                    ? 'Time unknown'
                    : event.occurredAt}
                  {' · '}{event.uncertainty}
                </span>
                <ul>
                  {event.claims.map((claim) => (
                    <li key={claim.claimId}>{claim.type}: {claim.rawValue}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : claims.length ? (
          <ul className="report-fact-list">
            {claims.map((claim) => (
              <li key={claim.id}>
                <strong>{claim.type}</strong>
                <span>{claim.rawValue} · {claim.sourceKind} · {claim.verificationStatus}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">No claims recorded yet.</p>
        )}
      </section>

      <section className="workspace-panel" aria-label="Answers">
        <h3 className="report-section-title">Answers</h3>
        {answered.length ? (
          <ul className="report-fact-list">
            {answered.map((q) => (
              <li key={q.id}>
                <strong>{q.prompt}</strong>
                <span>{q.answer?.text ?? q.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">No clarification answers recorded.</p>
        )}
      </section>

      <section className="workspace-panel" aria-label="Similar-case leads">
        <h3 className="report-section-title">Similar-case leads</h3>
        <p className="panel-lead">Leads captured at submit when TigerGraph was available. Investigative only.</p>
        {leadsNotice && <p role="status">{leadsNotice}</p>}
        {leadsError && <p role="alert">{leadsError}</p>}
        {leads.length > 0 && (
          <ul className="report-lead-list">
            {leads.map((lead) => (
              <li key={lead.id}>
                <p>{lead.classification} · {lead.reviewStatus}</p>
                <ol aria-label="Four-hop lead path" className="report-lead-path">
                  <li>Case {lead.path.source_case_id}</li>
                  <li>VPA {lead.path.source_vpa_id}</li>
                  <li>Account {lead.path.account_id}</li>
                  <li>VPA {lead.path.target_vpa_id}</li>
                  <li>Case {lead.path.target_case_id}</li>
                </ol>
              </li>
            ))}
          </ul>
        )}
        {!leads.length && (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void perform(async () => {
              setLeadsError('');
              setLeadsNotice('');
              try {
                const result = await api<{ status: string; leads: Lead[] }>(
                  `/investigations/${detail.id}/graph-leads`, token, { maxHops: 4 }, 'POST',
                );
                setLeads(result.leads);
                setLeadsNotice(result.leads.length
                  ? 'Similar-case search completed.'
                  : 'Similar-case search completed. No linked paths in scope.');
              } catch (failure) {
                setLeads([]);
                setLeadsError(failure instanceof ApiFailure && failure.status === 503
                  ? 'Similar-case search unavailable until TigerGraph is connected'
                  : failure instanceof Error ? failure.message : 'Similar-case search unavailable.');
              }
            })}
          >
            Retry search
          </button>
        )}
      </section>

      <section className="workspace-panel" aria-label="Draft report">
        <h3 className="report-section-title">Draft report</h3>
        <p className="panel-lead">
          Versioned HTML draft with provenance. Use Print / Save as PDF in your browser.
          {draftVersion != null ? ` Showing v${draftVersion}.` : ''}
          {exports.length === 0 ? ' No draft generated yet.' : ''}
        </p>
        <div className="action-row">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !draftHtml}
            onClick={() => printDraft()}
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void perform(async () => {
              await api(`/cases/${detail.id}/exports`, token, { draftAcknowledged: true }, 'POST');
              const exportRows = await api<ExportRow[]>(`/cases/${detail.id}/exports`, token);
              setExports(exportRows);
              const latest = exportRows[exportRows.length - 1];
              if (!latest) return;
              const response = await fetch(`/api/v1/cases/${detail.id}/exports/${latest.id}/download`, {
                headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
              });
              if (!response.ok) throw new ApiFailure(response.status, 'Draft unavailable.');
              setDraftHtml(await response.text());
              setDraftVersion(latest.version);
            })}
          >
            Regenerate draft
          </button>
        </div>
        {draftHtml && (
          <iframe
            ref={printRef}
            title={`Draft preview v${draftVersion ?? ''}`}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={draftHtml}
            className="report-draft-frame"
          />
        )}
      </section>

      <details
        className="workspace-panel report-advanced"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary>Advanced tools</summary>
        <p className="panel-lead">Investigator controls for demo depth — not the default review path.</p>
        <EvidencePanel token={token} caseId={detail.id} owner={false} busy={busy} perform={perform} autoLoad />
        <ReviewPanel token={token} caseId={detail.id} owner={false} busy={busy} refreshKey={0} perform={perform} />
        <QuestionsPanel token={token} caseId={detail.id} owner={false} busy={busy} perform={perform} />
        <ExportPanel token={token} caseId={detail.id} busy={busy} perform={perform} />
        <AnalystPanel token={token} caseId={detail.id} busy={busy} perform={perform} />
      </details>
    </article>
  );
}

function EvidenceThumb({ token, caseId, evidenceId }: { token: string; caseId: string; evidenceId: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    void (async () => {
      const response = await fetch(`/api/v1/cases/${caseId}/evidence/${evidenceId}/view`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (!response.ok || !active || typeof response.blob !== 'function') return;
      const blob = await response.blob();
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, caseId, evidenceId]);
  if (!url) return <div className="report-shot-placeholder" aria-hidden="true" />;
  return <img src={url} alt="Complaint screenshot" className="report-shot-img" />;
}
