#!/usr/bin/env node
/**
 * Regenerates data/synthetic/bootstrap.json with 200 fictional cases,
 * multi-cluster graph-friendly IDs, and officer INVESTIGATE grants for older cases.
 * Insert-only seed remains safe: IDs are stable across regenerations.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const org = '10000000-0000-4000-8000-000000000001';
const victimA = '20000000-0000-4000-8000-000000000001';
const victimB = '20000000-0000-4000-8000-000000000002';
const analyst = '20000000-0000-4000-8000-000000000003';
const CASE_COUNT = 200;

function uuid(prefixNibble, n) {
  const hex = n.toString(16).padStart(12, '0');
  // 8-char time_low: one nibble prefix + seven zeros (e.g. 30000000-...)
  return `${prefixNibble}${'0'.repeat(7)}-0000-4000-8000-${hex}`;
}

const titles = [
  'Synthetic Kochi-01', 'Synthetic Bengaluru-04', 'Synthetic Goa-03',
  'Synthetic Lookalike-04', 'Synthetic Lookalike-05',
];
const categories = ['investment', 'friendship', 'other', 'other', 'other', 'payment', 'payment', 'payment', 'investment', 'friendship'];

const cases = [];
for (let i = 1; i <= CASE_COUNT; i++) {
  const ownerId = i % 2 === 1 ? victimA : victimB;
  const title = i <= titles.length ? titles[i - 1] : `Synthetic Placeholder-${String(i).padStart(3, '0')}`;
  const category = categories[(i - 1) % categories.length];
  let scenarioNote = 'Fictional empty case.';
  if (i === 1) scenarioNote = 'Graph cluster A endpoint; shares fictional settlement account with case 02; no financial edge beyond authored fixture.';
  if (i === 2) scenarioNote = 'Graph cluster A endpoint; shares fictional settlement account with case 01.';
  if (i === 3) scenarioNote = 'Unrelated Goa placeholder; separate accounts.';
  if (i === 4 || i === 5) scenarioNote = 'Benign look-alike placeholder; shared domain text only, separate accounts.';
  if (i === 6 || i === 7) scenarioNote = 'Graph cluster B; shared fictional second-layer account.';
  if (i >= 8 && i <= 10) scenarioNote = 'Graph cluster C; shared fictional mule account path.';
  if (i > 20) scenarioNote = 'Older synthetic complaint for officer inbox density; fictional identifiers only.';
  cases.push({
    id: uuid('3', i),
    ownerId,
    organizationId: null,
    status: 'DRAFT',
    category,
    title,
    synthetic: true,
    scenarioNote,
  });
}

const grants = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    caseId: cases[0].id,
    organizationId: org,
    scope: 'INVESTIGATE',
    grantedBy: victimA,
    revokedAt: null,
    expiresAt: null,
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    caseId: cases[1].id,
    organizationId: org,
    scope: 'READ',
    grantedBy: victimB,
    revokedAt: '2026-10-28T01:00:00Z',
    expiresAt: null,
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    caseId: cases[2].id,
    organizationId: org,
    scope: 'READ',
    grantedBy: victimA,
    revokedAt: null,
    expiresAt: '2026-10-28T01:00:00Z',
  },
];

// Cases index 3–4 stay never-shared for auth fixtures. Older cases (index >= 5) get INVESTIGATE.
let grantN = 4;
for (let i = 5; i < CASE_COUNT; i++) {
  const c = cases[i];
  grants.push({
    id: uuid('4', grantN++),
    caseId: c.id,
    organizationId: org,
    scope: 'INVESTIGATE',
    grantedBy: c.ownerId,
    revokedAt: null,
    expiresAt: null,
  });
}

/** Stable recollection-only enrichment for a subset of older/demo cases (no upload bytes). */
const enrichment = [];
const enrichTargets = [0, 1, 5, 6, 7];
for (const index of enrichTargets) {
  const c = cases[index];
  const n = index + 1;
  const claimAmount = uuid('5', n * 10 + 1);
  const claimRef = uuid('5', n * 10 + 2);
  const claimTime = uuid('5', n * 10 + 3);
  const eventId = uuid('6', n);
  enrichment.push({
    caseId: c.id,
    event: {
      id: eventId,
      eventType: 'payment',
      precision: 'APPROXIMATE',
      uncertainty: 'Fictional approximate recollection only; not bank-verified.',
      occurredAt: `2026-09-${String(10 + (n % 15)).padStart(2, '0')}T12:00:00.000Z`,
    },
    claims: [
      { id: claimAmount, type: 'payment_amount', rawValue: `INR ${1500 + n * 100}`, sourceKind: 'VICTIM_RECOLLECTION' },
      { id: claimRef, type: 'payment_reference', rawValue: `SYN-UTR-${String(n).padStart(4, '0')}`, sourceKind: 'VICTIM_RECOLLECTION' },
      { id: claimTime, type: 'incident_time', rawValue: `2026-09-${String(10 + (n % 15)).padStart(2, '0')}T12:00:00.000Z`, sourceKind: 'VICTIM_RECOLLECTION' },
    ],
  });
}

const fixture = {
  label: 'CASEGRAPH SYNTHETIC FIXTURE — fictional cases only; no real victims or bank records',
  organization: {
    id: org,
    name: 'Fictional Demo Consortium',
    kind: 'SYNTHETIC',
    synthetic: true,
  },
  users: [
    {
      id: victimA,
      role: 'victim',
      displayName: 'Fictional Victim A',
      organizationId: null,
      demoSubject: 'synthetic-victim-a',
      synthetic: true,
    },
    {
      id: victimB,
      role: 'victim',
      displayName: 'Fictional Victim B',
      organizationId: null,
      demoSubject: 'synthetic-victim-b',
      synthetic: true,
    },
    {
      id: analyst,
      role: 'analyst',
      displayName: 'Fictional Analyst',
      organizationId: org,
      demoSubject: 'synthetic-analyst',
      synthetic: true,
    },
  ],
  cases,
  grants,
  enrichment,
};

const out = join(root, 'bootstrap.json');
writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${CASE_COUNT} synthetic cases, ${grants.length} grants, ${enrichment.length} enriched cases to ${out}`);
