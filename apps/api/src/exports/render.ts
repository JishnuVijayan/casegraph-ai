import { Brief, EntityKind, Fact, FactGroup, SimilarCase, SourceType, Victim } from '../intake/types';

/** Escapes any value for HTML text and attribute positions. Every user-controlled string goes through this. */
export function esc(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return text.replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]!);
}
export const ENTITY_LABEL: Record<EntityKind, string> = {
  phone: 'Phone number', upi: 'UPI ID', bank_account: 'Bank account', url: 'Website or link', email: 'Email address',
  person_name: 'Name used', app_name: 'App name', ifsc: 'Bank branch code (IFSC)', social_handle: 'Social media handle',
};
export const GROUP_LABEL: Record<FactGroup, string> = {
  money: 'Money', people: 'People', channels: 'How they reached you', accounts: 'Accounts and payments', time: 'Dates and times', other: 'Other details',
};
export const SOURCE_LABEL: Record<SourceType, string> = { FILE: 'Read from your files', STORY: 'What you told us', AI: 'Worked out by AI' };
const GROUP_ORDER: FactGroup[] = ['money', 'accounts', 'channels', 'people', 'time', 'other'];

export const REPORT_CSS = `
:root{--ink:#14202b;--muted:#5b6773;--line:#d9dee3;--soft:#f4f6f8;--accent:#1d4e89;--warn:#8a4b00}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.page{max-width:820px;margin:0 auto;padding:40px 32px 56px}
header.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:3px solid var(--accent);padding-bottom:16px;margin-bottom:24px}
.brand{font-weight:700;letter-spacing:.02em;color:var(--accent);font-size:13px;text-transform:uppercase}
h1{font-size:24px;line-height:1.25;margin:6px 0 0}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin:30px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line);break-after:avoid}
h3{font-size:14px;margin:16px 0 6px;break-after:avoid}
.ref{text-align:right;font-size:13px;color:var(--muted)}.ref strong{display:block;font-size:18px;color:var(--ink);letter-spacing:.03em}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 8px}
.meta div{background:var(--soft);border-radius:8px;padding:10px 12px}.meta b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:2px}
.summary{font-size:16px}
ol.timeline{list-style:none;margin:0;padding:0;border-left:2px solid var(--line)}
ol.timeline li{position:relative;padding:0 0 14px 18px;break-inside:avoid}
ol.timeline li::before{content:"";position:absolute;left:-6px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--accent)}
.when{font-weight:600}.detail{color:var(--ink)}.src{color:var(--muted);font-size:12px}
table{width:100%;border-collapse:collapse;margin:6px 0 4px}
th,td{text-align:left;vertical-align:top;padding:7px 8px;border-bottom:1px solid var(--line);font-size:14px;overflow-wrap:anywhere}
th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
tr{break-inside:avoid}.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}
.story{white-space:pre-wrap;background:var(--soft);border-radius:8px;padding:12px 14px;margin:6px 0;overflow-wrap:anywhere}
.none{color:var(--warn);font-style:italic}.note{color:var(--muted);font-size:13px}
.chip{display:inline-block;border-radius:99px;padding:1px 9px;font-size:12px;background:#e8eef6;color:var(--accent)}
.chip.strong{background:#fde8e6;color:#8f1d12}.chip.weak{background:#fff1d6;color:#7a4a00}
.help{margin-top:34px;padding:14px 16px;border:1px solid var(--accent);border-radius:8px;background:#f1f6fc;break-inside:avoid}
footer{margin-top:20px;color:var(--muted);font-size:12px}
a.evref{color:var(--accent);font-weight:600;text-decoration:none;white-space:nowrap}a.evref:hover{text-decoration:underline}
.evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin:10px 0}
figure.ev{margin:0;border:1px solid var(--line);border-radius:10px;padding:12px;background:#fff;break-inside:avoid;scroll-margin-top:16px}
figure.ev.wide,figure.ev.doc{grid-column:1/-1}
figure.ev figcaption{font-size:14px;margin-bottom:8px}figure.ev figcaption strong{color:var(--accent)}
figure.ev img{display:block;width:100%;height:auto;max-height:880px;object-fit:contain;background:var(--soft);border-radius:6px;border:1px solid var(--line)}
.ev-used{margin-top:10px;font-size:13px}.ev-used b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px}
.ev-used ul{margin:0;padding-left:18px}.ev-hash{margin-top:8px;font-size:11px;color:var(--muted);word-break:break-all}
@media (max-width:640px){.evidence-grid{grid-template-columns:1fr}}
@media (max-width:560px){.page{padding:20px 16px}header.top{display:block}.ref{text-align:left;margin-top:10px}}
@media print{.page{max-width:none;padding:0}@page{size:A4;margin:16mm 14mm}h2{margin-top:20px}a{color:inherit;text-decoration:none}}
`;

export const money = (loss: Brief['totalLoss']) => loss ? `₹${loss.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : null;
export const sizeLabel = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
export const dateLabel = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST' : '';

export function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${esc(title)}</title><style>${REPORT_CSS}</style></head><body><div class="page">${body}</div></body></html>`;
}

export type ReportImage = { src: string; width: number; height: number };
export type ReportImages = Map<string, ReportImage>;
/** "Evidence 1", "Evidence 2"... in the order the files were added; the same numbers are used everywhere in the report. */
const evidenceNo = (brief: Brief, id?: string) => (id ? brief.evidence.findIndex((e) => e.id === id) + 1 : 0);
const evidenceRef = (brief: Brief, id?: string) => { const n = evidenceNo(brief, id); return n > 0 ? `<a class="evref" href="#evidence-${n}">See Evidence ${n}</a>` : ''; };

export function timelineHtml(brief: Brief): string {
  if (!brief.timeline.length) return '<p class="none">Not provided.</p>';
  return `<ol class="timeline">${brief.timeline.map((t) => {
    const refs = [...new Set(t.sources.map((s) => s.evidenceId).filter((id): id is string => !!id))].map((id) => evidenceRef(brief, id)).filter(Boolean);
    return `<li><div class="when">${esc(t.atLabel)} &mdash; ${esc(t.title)}</div>` +
      (t.detail ? `<div class="detail">${esc(t.detail)}</div>` : '') +
      `<div class="src">${esc([...new Set(t.sources.map((s) => SOURCE_LABEL[s.type]))].join(' · '))}${refs.length ? ` · ${refs.join(' · ')}` : ''}</div></li>`;
  }).join('')}</ol>`;
}
export function factsHtml(facts: Fact[], brief?: Brief): string {
  const groups = GROUP_ORDER.filter((g) => facts.some((f) => f.group === g));
  if (!groups.length) return '<p class="none">Not provided.</p>';
  return groups.map((g) => `<h3>${esc(GROUP_LABEL[g])}</h3><table><tbody>${facts.filter((f) => f.group === g).map((f) =>
    `<tr><td style="width:34%">${esc(f.label)}</td><td>${esc(f.value)} <span class="src">(${esc(SOURCE_LABEL[f.source])}${brief && f.evidenceId && evidenceNo(brief, f.evidenceId) ? ` · ${evidenceRef(brief, f.evidenceId)}` : ''})</span></td></tr>`).join('')}</tbody></table>`).join('');
}
export function entitiesHtml(brief: Brief): string {
  if (!brief.entities.length) return '<p class="none">Not provided.</p>';
  return `<table><thead><tr><th>Type</th><th>Detail</th></tr></thead><tbody>${brief.entities.map((e) =>
    `<tr><td style="width:34%">${esc(ENTITY_LABEL[e.kind])}</td><td class="mono">${esc(e.value)}</td></tr>`).join('')}</tbody></table>`;
}
export function evidenceHtml(brief: Brief, images: ReportImages = new Map()): string {
  if (!brief.evidence.length) return '<p class="none">No files added.</p>';
  const cards = brief.evidence.map((e, i) => {
    const n = i + 1, img = images.get(e.id);
    const facts = brief.facts.filter((f) => f.evidenceId === e.id);
    const steps = brief.timeline.filter((t) => t.sources.some((s) => s.evidenceId === e.id));
    const used = facts.length || steps.length
      ? `<div class="ev-used"><b>What was taken from this file</b><ul>${steps.map((t) => `<li>Timeline: ${esc(t.atLabel)} &mdash; ${esc(t.title)}</li>`).join('')}${facts.map((f) => `<li>${esc(f.label)}: <span class="mono">${esc(f.value)}</span></li>`).join('')}</ul></div>`
      : '';
    const wide = img && img.width > img.height;
    const caption = `<figcaption><strong>Evidence ${n}</strong> &middot; ${esc(e.name)} <span class="src">(${esc(e.kind === 'image' ? 'Image' : 'Document')} &middot; ${esc(sizeLabel(e.sizeBytes))}${e.readStatus === 'FAILED' ? ' &middot; could not be read' : ''})</span></figcaption>`;
    const body = img
      ? `<img src="${esc(img.src)}" width="${img.width}" height="${img.height}" alt="Evidence ${n}: ${esc(e.name)}">`
      : e.kind === 'image' ? '<p class="note">The picture could not be added to this report. The original file is unchanged.</p>'
        : '<p class="note">This is a document. It is kept unchanged with the complaint and is not shown here.</p>';
    return `<figure class="ev${wide ? ' wide' : ''}${!img ? ' doc' : ''}" id="evidence-${n}">${caption}${body}${used}<div class="ev-hash">SHA-256 of the original file: <span class="mono">${esc(e.sha256)}</span></div></figure>`;
  }).join('');
  return `<div class="evidence-grid">${cards}</div>
<p class="note">Pictures are shown at a reduced size to keep this report small. The original files are stored unchanged. The SHA-256 fingerprint proves a file has not changed since it was added. It does not prove who sent it.</p>`;
}
export function questionsHtml(brief: Brief): string {
  if (!brief.questions.length) return '<p class="note">No further questions.</p>';
  return `<table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>${brief.questions.map((q) => `<tr><td>${esc(q.prompt)}</td><td>${
    q.status === 'ANSWERED' ? esc(q.answer) : q.status === 'UNKNOWN' ? 'Do not know' : '<span class="none">Not provided</span>'}</td></tr>`).join('')}</tbody></table>`;
}
export function storyHtml(brief: Brief): string {
  return brief.narratives.length ? brief.narratives.map((n) => `<div class="story">${esc(n.text)}</div>`).join('') : '<p class="none">Not provided.</p>';
}
const helpline = `<div class="help"><strong>National cyber crime helpline 1930.</strong> If money was taken recently, call <strong>1930</strong> now and tell your bank.
You can also file or track a complaint at <strong>cybercrime.gov.in</strong>.</div>`;

export function renderReportHtml(brief: Brief, victim: Victim, generatedAt = new Date(), images: ReportImages = new Map()): string {
  const loss = money(brief.totalLoss);
  const body = `<header class="top"><div><div class="brand">CaseGraph &middot; Complaint report</div><h1>${esc(brief.title)}</h1></div>
<div class="ref">Reference<strong>${esc(brief.reference)}</strong>${esc(dateLabel(generatedAt.toISOString()))}</div></header>
<div class="meta"><div><b>Complainant</b>${esc(victim.name)}${victim.mobile ? `<br>${esc(victim.mobile)}` : ''}</div>
<div><b>Type of crime</b>${esc(brief.categoryLabel)}</div><div><b>Money lost</b>${loss ? esc(loss) : 'None reported'}</div>
<div><b>Status</b>${brief.status === 'SUBMITTED' ? 'Submitted' : 'Not yet submitted'}</div></div>
<h2>Summary</h2><p class="summary">${brief.summary ? esc(brief.summary) : '<span class="none">Not provided.</span>'}</p>
<h2>What happened, in order</h2>${timelineHtml(brief)}
<h2>Key details</h2>${factsHtml(brief.facts, brief)}
<h2>Details of the other party</h2>${entitiesHtml(brief)}
<p class="note">Your own name and number are not listed here.</p>
<h2>Your account in your own words</h2>${storyHtml(brief)}
<h2>Your evidence</h2>${evidenceHtml(brief, images)}
<h2>Questions</h2>${questionsHtml(brief)}
${helpline}
<footer>This report was prepared with AI assistance from the information and files you gave. Please read it carefully and correct anything that is wrong before you use it.
It is not an official police record and does not say who is responsible.</footer>`;
  return page(`Complaint ${brief.reference}`, body);
}

export type { SimilarCase };
