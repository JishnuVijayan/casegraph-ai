import { cases, claims, claimRevisions, clarifications, timelineEvents } from '../db/schema';
export type Snapshot = {
  case: Pick<typeof cases.$inferSelect, 'id' | 'title' | 'category'>;
  version: number; generatedAt: string;
  evidence: { id: string; sha256: string; mimeType: string; sizeBytes: number; createdAt: Date }[];
  claims: (typeof claims.$inferSelect)[];
  sources: { claimId: string; evidenceId: string; regionId: string | null; observedText: string | null; textSpan: unknown; boundingBox: unknown }[];
  revisions: (typeof claimRevisions.$inferSelect)[];
  events: (typeof timelineEvents.$inferSelect)[];
  links: { eventId: string; claimId: string }[];
  questions: ((typeof clarifications.$inferSelect) & { isCurrent: boolean })[];
};
export function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? 'UNKNOWN' : value instanceof Date ? value.toISOString()
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return str.replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
}
export function renderDraft(s: Snapshot): string {
  const e = escapeHtml;
  const table = (head: string[], rows: unknown[][]) => rows.length ? `<table><thead><tr>${head.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>None recorded. Details remain unknown.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>CaseGraph AI — DRAFT — v${s.version}</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem;color:#111}table{border-collapse:collapse;width:100%;margin-bottom:2rem}th,td{border:1px solid #888;text-align:left;vertical-align:top;padding:.5rem;overflow-wrap:anywhere;white-space:pre-wrap}h1,h2{break-after:avoid}tr{break-inside:avoid}@media print{body{margin:0;font-size:10pt}@page{margin:15mm}}</style></head><body>
<h1>DRAFT — Incident report</h1><p>For human review. No official complaint has been filed by this application. No government, police or bank affiliation. No guaranteed recovery or court admissibility.</p>
<p>For ongoing financial fraud: call 1930, notify the bank immediately and use cybercrime.gov.in.</p>
<p>Case: ${e(s.case.id)} · Version: ${s.version} · Generated (UTC): ${e(s.generatedAt)}</p>
<h2>Incident summary</h2><p>${e(s.case.title)} · Category: ${e(s.case.category)}</p>
<p>This draft lists recorded claims and user-linked events. It does not infer a culprit or independently verify transactions. Review and correct claims in the application, then generate a new version. Keep downloaded copies private. Use your browser’s Print / Save as PDF command.</p>
<h2>Chronological index</h2>${table(['Event ID / type','Time / precision','Uncertainty','Supporting claim IDs'],s.events.map((x) => [x.id+' / '+x.eventType,x.precision === 'DATE_ONLY' ? x.occurredAt?.toISOString().slice(0,10)+' / DATE_ONLY' : (x.occurredAt?.toISOString() ?? 'UNKNOWN')+' / '+x.precision,x.uncertainty,s.links.filter((l)=>l.eventId===x.id).map((l)=>l.claimId).join('\n')]))}
<h2>Claims and interpreted values</h2>${table(['Claim ID / type','Current interpretation','Normalized value','Source kind','Verification'],s.claims.map((c)=>[c.id+' / '+c.type,c.rawValue,c.normalizedValue,c.sourceKind,c.verificationStatus]))}
<h2>Source observations</h2>${table(['Claim ID','Evidence ID / OCR region','Original observed text','Span / normalized box'],s.sources.map((x)=>[x.claimId,x.evidenceId+' / '+(x.regionId??'UNKNOWN'),x.observedText,{textSpan:x.textSpan,boundingBox:x.boundingBox}]))}
<p>VICTIM_RECOLLECTION records may have no uploaded source. OBSERVED_IN_UPLOAD means text observed in an upload. SYSTEM_INFERENCE is an inference; AUTHORIZED_EXTERNAL_RECORD requires an actual authorized source. A screenshot or victim answer is not independent bank verification.</p>
<h2>Correction history</h2>${table(['Claim ID','Before','After','Reason / changed at'],s.revisions.map((r)=>[r.claimId,r.before,r.after,(r.reason??'No note')+' / '+r.changedAt.toISOString()]))}
<h2>Questions, answers and remaining uncertainty</h2>${table(['Question / type','State at export','Source snapshot','Answer'],s.questions.map((q)=>[q.prompt+' / '+q.kind,q.status+(q.isCurrent?' / Current':' / Superseded'),q.context,q.answer]))}
<p>OPEN questions remain unresolved. UNKNOWN answers remain unknown. Answers are unverified recollections and do not replace the recorded claims. Superseded questions describe earlier interpretations.</p>
<h2>Evidence SHA-256 manifest</h2><p>Hashes and sizes were recorded at ingest. This export does not re-read every original or authenticate a screenshot, its sender or the underlying transaction.</p>
${table(['Source ID','SHA-256','MIME / bytes','Uploaded (UTC)'],s.evidence.map((x)=>[x.id,x.sha256,x.mimeType+' / '+x.sizeBytes,x.createdAt]))}
<h2>Limitations</h2><p>Local demo prototype. OCR may be inaccurate; missing details remain unknown. Dates and times retain recorded precision. Official submission and external bank verification are not provided by this draft. Evidence originals are separate private files and are not embedded. This version is a frozen snapshot; later corrections appear only in a new export.</p></body></html>`;
}
