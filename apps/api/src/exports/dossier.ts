import { Brief, EntityKind, SharedEntity, SimilarCase, SimilarStatus, Victim } from '../intake/types';
import {
  ENTITY_LABEL, ReportImages, dateLabel, entitiesHtml, esc, evidenceHtml, factsHtml, money, page, questionsHtml, storyHtml, timelineHtml,
} from './render';

export type DossierSimilar = { status: SimilarStatus; cases: SimilarCase[] };

const sharedList = (shared: SharedEntity[]) => shared.length
  ? shared.map((s) => `<div><span class="chip ${s.strength === 'STRONG' ? 'strong' : 'weak'}">${esc(ENTITY_LABEL[s.kind])}</span> <span class="mono">${esc(s.value)}</span></div>`).join('')
  : '<span class="note">Similar wording only</span>';

function similarHtml(similar: DossierSimilar): string {
  if (similar.status === 'UNAVAILABLE') {
    return '<p class="none">The case network could not be reached when this file was prepared, so earlier complaints could not be compared. Nothing has been assumed.</p>';
  }
  if (!similar.cases.length) return '<p class="note">No earlier complaint shares a phone number, UPI ID, bank account, website or pattern with this one.</p>';
  return `<table><thead><tr><th>Earlier complaint</th><th>Match</th><th>Shares with this case</th></tr></thead><tbody>${similar.cases.map((c) =>
    `<tr><td><strong>${esc(c.reference)}</strong><div>${esc(c.title)}</div><div class="src">${esc(c.categoryLabel)} · ${esc(c.loss ? money(c.loss) : 'loss not stated')} · reported ${esc(dateLabel(c.submittedAt))}</div>` +
    `<div class="src">${esc(c.summary)}</div></td><td>${esc(c.score)} / 100<div class="src">${esc(c.reason)}</div></td><td>${sharedList(c.shared)}</td></tr>`).join('')}</tbody></table>
<p class="note">Shared details mean the same identifier was also reported in the other complaint. They are leads to check, not proof about any person.</p>`;
}

function sharedEntityTable(brief: Brief, similar: DossierSimilar): string {
  const rows = new Map<string, { kind: EntityKind; value: string; refs: string[]; strength: 'STRONG' | 'WEAK' }>();
  for (const c of similar.cases) for (const s of c.shared) {
    const key = `${s.kind}:${s.value.toLowerCase()}`;
    const row = rows.get(key) ?? { kind: s.kind, value: s.value, refs: [], strength: s.strength };
    row.refs.push(c.reference); rows.set(key, row);
  }
  if (!rows.size) return '<p class="note">No shared details.</p>';
  const sorted = [...rows.values()].sort((a, b) => b.refs.length - a.refs.length || a.kind.localeCompare(b.kind));
  return `<table><thead><tr><th>Detail</th><th>Also reported in</th></tr></thead><tbody>${sorted.map((r) =>
    `<tr><td><span class="chip ${r.strength === 'STRONG' ? 'strong' : 'weak'}">${esc(ENTITY_LABEL[r.kind])}</span><div class="mono">${esc(r.value)}</div></td><td>${esc(r.refs.join(', '))} (${r.refs.length} ${r.refs.length === 1 ? 'complaint' : 'complaints'})</td></tr>`).join('')}</tbody></table>`;
}

/** Officer case file: this complaint, similar complaints side by side, and the details they share. */
export function renderDossierHtml(brief: Brief, victim: Victim, similar: DossierSimilar, generatedAt = new Date(), images: ReportImages = new Map()): string {
  const loss = money(brief.totalLoss);
  const body = `<header class="top"><div><div class="brand">CaseGraph &middot; Case file</div><h1>${esc(brief.title)}</h1></div>
<div class="ref">Reference<strong>${esc(brief.reference)}</strong>${esc(dateLabel(generatedAt.toISOString()))}</div></header>
<div class="meta"><div><b>Complainant</b>${esc(victim.name)}${victim.mobile ? `<br>${esc(victim.mobile)}` : ''}</div>
<div><b>Type of crime</b>${esc(brief.categoryLabel)}</div><div><b>Money lost</b>${loss ? esc(loss) : 'None reported'}</div>
<div><b>Completeness</b>${esc(brief.completeness.percent)}%</div></div>
<h2>Summary</h2><p class="summary">${brief.summary ? esc(brief.summary) : '<span class="none">Not provided.</span>'}</p>
<h2>What happened, in order</h2>${timelineHtml(brief)}
<h2>Key details</h2>${factsHtml(brief.facts, brief)}
<h2>Details of the other party</h2>${entitiesHtml(brief)}
<h2>Similar complaints</h2>${similarHtml(similar)}
<h2>Details shared with other complaints</h2>${sharedEntityTable(brief, similar)}
<h2>Complainant's account</h2>${storyHtml(brief)}
<h2>Evidence</h2>${evidenceHtml(brief, images)}
<h2>Questions and answers</h2>${questionsHtml(brief)}
<footer>Prepared with AI assistance from what the complainant provided. Items marked &ldquo;Worked out by AI&rdquo; are not verified. Similar complaints are leads to review, not findings.</footer>`;
  return page(`Case file ${brief.reference}`, body);
}
